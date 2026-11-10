#!/usr/bin/env python3
"""Validate the Cozy Cast GLBs without third-party Python packages.

Usage:
  python3 validate_glb.py                        # sibling models/*.glb
  python3 validate_glb.py models --json report.json
  python3 validate_glb.py model.glb --kind human --strict-size
  python3 validate_glb.py models --creature some_other_creature.glb
  python3 validate_glb.py --self-test

Checks use decoded binary data, not accessor min/max metadata. Triangle totals
include all assembled triangles, including degenerates, and are also reported
for active scene instances. Rest bounds include node transforms, morph defaults,
and linear-blend skinning. Humanoid compatibility means the named joint-parent
chains and rest topology agree; it does not certify compatibility with a
particular commercial retargeter or visually verify a character's facing.

Exit codes: 0 passed (warnings allowed), 1 validation failed, 2 CLI/input error.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import pathlib
import struct
import sys
import tempfile
from typing import Any

VERSION = "1.0"
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
TYPE_SHAPES = {"SCALAR": (1, 1), "VEC2": (1, 2), "VEC3": (1, 3),
               "VEC4": (1, 4), "MAT2": (2, 2), "MAT3": (3, 3), "MAT4": (4, 4)}
IDENTITY = [1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.]
CREATURES = {"leaftail.glb", "mossling.glb", "lanternfly.glb"}
HUMAN_ANIMATIONS = {"idle": 2., "walk": 1., "run": .7, "swing": .45, "talk": 2., "wave": 1.}
CORE_PARENTS = {"hips": None, "spine": "hips", "chest": "spine", "neck": "chest", "head": "neck"}
for _side in ("L", "R"):
    CORE_PARENTS.update({f"upper_arm.{_side}": "chest", f"lower_arm.{_side}": f"upper_arm.{_side}",
                         f"hand.{_side}": f"lower_arm.{_side}", f"upper_leg.{_side}": "hips",
                         f"lower_leg.{_side}": f"upper_leg.{_side}", f"foot.{_side}": f"lower_leg.{_side}"})


class ValidationError(ValueError):
    pass


def mul(a, b):
    """Multiply column-major 4x4 matrices."""
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
            for c in range(4) for r in range(4)]


def transform(m, p):
    return tuple(sum(m[c * 4 + r] * p[c] for c in range(3)) + m[12 + r] for r in range(3))


def node_matrix(node):
    if "matrix" in node:
        m = node["matrix"]
        if len(m) != 16 or not all(math.isfinite(x) for x in m):
            raise ValidationError("Node matrix must contain 16 finite numbers")
        if any(k in node for k in ("translation", "rotation", "scale")):
            raise ValidationError("Node cannot contain both matrix and TRS")
        return list(m)
    t, q, s = node.get("translation", [0., 0., 0.]), node.get("rotation", [0., 0., 0., 1.]), node.get("scale", [1., 1., 1.])
    if len(t) != 3 or len(q) != 4 or len(s) != 3 or not all(math.isfinite(x) for x in t + q + s):
        raise ValidationError("Invalid node TRS")
    x, y, z, w = q
    if abs(sum(v*v for v in q) - 1.) > .005:
        raise ValidationError("Node rotation quaternion is not unit length")
    return [(1 - 2*y*y - 2*z*z)*s[0], (2*x*y + 2*z*w)*s[0], (2*x*z - 2*y*w)*s[0], 0.,
            (2*x*y - 2*z*w)*s[1], (1 - 2*x*x - 2*z*z)*s[1], (2*y*z + 2*x*w)*s[1], 0.,
            (2*x*z + 2*y*w)*s[2], (2*y*z - 2*x*w)*s[2], (1 - 2*x*x - 2*y*y)*s[2], 0.,
            t[0], t[1], t[2], 1.]


def canonical_bone(name):
    """Accept common punctuation/case conventions without inventing mappings."""
    n = name.lower().split(":")[-1].replace("mixamorig", "")
    n = "".join(c for c in n if c.isalnum())
    if n in ("hips", "pelvis"):
        return "hips"
    if n in ("spine", "chest", "neck", "head"):
        return n
    side = None
    if n.startswith("left"):
        side, n = "L", n[4:]
    elif n.startswith("right"):
        side, n = "R", n[5:]
    elif n.endswith(("left", "right")):
        side, n = ("L", n[:-4]) if n.endswith("left") else ("R", n[:-5])
    elif n.endswith(("l", "r")):
        side, n = n[-1].upper(), n[:-1]
    elif n.startswith(("l", "r")) and n[1:] in ("upperarm", "lowerarm", "forearm", "hand", "upperleg", "lowerleg", "thigh", "shin", "foot"):
        side, n = n[0].upper(), n[1:]
    aliases = {"upperarm": "upper_arm", "arm": "upper_arm", "lowerarm": "lower_arm", "forearm": "lower_arm",
               "hand": "hand", "upperleg": "upper_leg", "upleg": "upper_leg", "thigh": "upper_leg",
               "lowerleg": "lower_leg", "leg": "lower_leg", "shin": "lower_leg", "foot": "foot"}
    return f"{aliases[n]}.{side}" if side and n in aliases else None


class GLB:
    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.raw = self.path.read_bytes()
        self.cache = {}
        self.external_buffers = []
        if len(self.raw) < 20:
            raise ValidationError("File is too short to be GLB")
        magic, version, total = struct.unpack_from("<4sII", self.raw)
        if magic != b"glTF" or version != 2:
            raise ValidationError("Expected glTF 2.0 binary header")
        if total != len(self.raw):
            raise ValidationError(f"Header length {total} differs from actual {len(self.raw)} bytes")
        chunks = []
        offset = 12
        while offset < len(self.raw):
            if offset + 8 > len(self.raw):
                raise ValidationError("Truncated chunk header")
            size, kind = struct.unpack_from("<I4s", self.raw, offset)
            offset += 8
            if size % 4 or offset + size > len(self.raw):
                raise ValidationError("Invalid chunk alignment or truncated chunk data")
            chunks.append((kind, self.raw[offset:offset + size]))
            offset += size
        if not chunks or chunks[0][0] != b"JSON" or sum(k == b"JSON" for k, _ in chunks) != 1:
            raise ValidationError("GLB must begin with exactly one JSON chunk")
        if sum(k == b"BIN\0" for k, _ in chunks) > 1:
            raise ValidationError("GLB has multiple BIN chunks")
        self.doc = json.loads(chunks[0][1].decode("utf-8"))
        if self.doc.get("asset", {}).get("version") != "2.0":
            raise ValidationError("asset.version must be 2.0")
        bin_chunks = [data for kind, data in chunks if kind == b"BIN\0"]
        self.buffers = []
        for i, buf in enumerate(self.doc.get("buffers", [])):
            uri = buf.get("uri")
            if uri is None:
                if i != 0 or not bin_chunks:
                    raise ValidationError("Buffer has no URI or associated BIN chunk")
                data = bin_chunks[0]
            elif uri.startswith("data:"):
                if ";base64," not in uri:
                    raise ValidationError("Only base64 data URIs are supported")
                data = base64.b64decode(uri.split(",", 1)[1], validate=True)
            else:
                # Read-only local support, no remote fetches or path traversal.
                target = (self.path.parent / uri).resolve()
                if not target.is_relative_to(self.path.parent.resolve()):
                    raise ValidationError("External buffer leaves the GLB directory")
                self.external_buffers.append(uri)
                data = target.read_bytes()
            declared = buf.get("byteLength", -1)
            if declared < 0 or declared > len(data):
                raise ValidationError(f"Buffer {i} byteLength exceeds available bytes")
            if uri is None and len(data) - declared > 3:
                raise ValidationError("BIN chunk has more than three padding bytes")
            self.buffers.append(data[:declared])
        self.nodes = self.doc.get("nodes", [])
        self.parents = {}
        for i, node in enumerate(self.nodes):
            for child in node.get("children", []):
                if not isinstance(child, int) or not 0 <= child < len(self.nodes):
                    raise ValidationError(f"Invalid child node {child}")
                if child in self.parents:
                    raise ValidationError(f"Node {child} has more than one parent")
                self.parents[child] = i
        self.world = {}
        for i in range(len(self.nodes)):
            self.world_matrix(i, set())
        scenes = self.doc.get("scenes", [])
        if scenes:
            s = self.doc.get("scene", 0)
            if not 0 <= s < len(scenes):
                raise ValidationError("Invalid default scene")
            self.roots = scenes[s].get("nodes", [])
        else:
            self.roots = [i for i in range(len(self.nodes)) if i not in self.parents]
        self.active = set()
        def visit(i):
            if not 0 <= i < len(self.nodes):
                raise ValidationError("Invalid scene root")
            if i in self.active:
                return
            self.active.add(i)
            for child in self.nodes[i].get("children", []):
                visit(child)
        for i in self.roots:
            if i in self.parents:
                raise ValidationError("Scene root is not a root node")
            visit(i)

    def world_matrix(self, i, seen):
        if i in self.world:
            return self.world[i]
        if i in seen:
            raise ValidationError("Node hierarchy contains a cycle")
        seen.add(i)
        matrix = node_matrix(self.nodes[i])
        if i in self.parents:
            matrix = mul(self.world_matrix(self.parents[i], seen), matrix)
        seen.remove(i)
        self.world[i] = matrix
        return matrix

    def read_view(self, index):
        views = self.doc.get("bufferViews", [])
        if not isinstance(index, int) or not 0 <= index < len(views):
            raise ValidationError(f"Invalid bufferView {index}")
        view = views[index]
        if "EXT_meshopt_compression" in view.get("extensions", {}):
            raise ValidationError("Meshopt-compressed bufferView requires decompression; not counted as verified")
        b = view.get("buffer", -1)
        if not isinstance(b, int) or not 0 <= b < len(self.buffers):
            raise ValidationError("Invalid buffer index")
        offset, size = view.get("byteOffset", 0), view.get("byteLength", -1)
        if offset < 0 or size < 0 or offset + size > len(self.buffers[b]):
            raise ValidationError("bufferView exceeds its buffer")
        return memoryview(self.buffers[b])[offset:offset + size], view

    def unpack_elements(self, view_i, offset, count, component, type_name, tightly_packed=False):
        if component not in COMPONENTS or type_name not in TYPE_SHAPES:
            raise ValidationError("Invalid accessor component/type")
        data, view = self.read_view(view_i)
        fmt, size = COMPONENTS[component]
        columns, rows = TYPE_SHAPES[type_name]
        column_size = ((rows * size + 3) // 4) * 4 if columns > 1 else rows * size
        elem_size = columns * column_size
        stride = elem_size if tightly_packed else view.get("byteStride", elem_size)
        if stride < elem_size or stride % size or offset < 0 or offset % size or count < 0:
            raise ValidationError("Invalid accessor offset, count, or stride")
        if count and offset + (count - 1) * stride + elem_size > len(data):
            raise ValidationError("Accessor exceeds bufferView bounds")
        offsets = [c * column_size + r * size for c in range(columns) for r in range(rows)]
        unpack = struct.Struct("<" + fmt).unpack_from
        result = [tuple(unpack(data, offset + i * stride + k)[0] for k in offsets) for i in range(count)]
        if component == 5126 and any(not math.isfinite(v) for row in result for v in row):
            raise ValidationError("Accessor contains NaN or infinity")
        return result

    def accessor(self, index):
        if index in self.cache:
            return self.cache[index]
        accessors = self.doc.get("accessors", [])
        if not isinstance(index, int) or not 0 <= index < len(accessors):
            raise ValidationError(f"Invalid accessor {index}")
        a = accessors[index]
        component, type_name, count = a["componentType"], a["type"], a["count"]
        if component not in COMPONENTS or type_name not in TYPE_SHAPES or count < 0:
            raise ValidationError(f"Invalid accessor {index} format")
        cols, rows = TYPE_SHAPES[type_name]
        result = (self.unpack_elements(a["bufferView"], a.get("byteOffset", 0), count, component, type_name)
                  if "bufferView" in a else [(0,) * (cols * rows) for _ in range(count)])
        sparse = a.get("sparse")
        if sparse:
            n = sparse["count"]
            if not 0 <= n <= count:
                raise ValidationError("Sparse accessor count exceeds accessor")
            ids, values = sparse["indices"], sparse["values"]
            if ids["componentType"] not in (5121, 5123, 5125):
                raise ValidationError("Sparse indices must be unsigned integers")
            indices = self.unpack_elements(ids["bufferView"], ids.get("byteOffset", 0), n, ids["componentType"], "SCALAR", True)
            replacement = self.unpack_elements(values["bufferView"], values.get("byteOffset", 0), n, component, type_name, True)
            last = -1
            for (j,), row in zip(indices, replacement):
                if j <= last or j >= count:
                    raise ValidationError("Sparse indices are not increasing or exceed accessor")
                result[j], last = row, j
        if a.get("normalized"):
            divisors = {5120: 127., 5121: 255., 5122: 32767., 5123: 65535.}
            if component not in divisors:
                raise ValidationError("Invalid normalized accessor type")
            divisor = divisors[component]
            result = [tuple(max(-1., x / divisor) for x in row) for row in result]
        self.cache[index] = result
        return result


def bounds(points):
    if not points:
        return None
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    return {"min": lo, "max": hi, "extent": [hi[i] - lo[i] for i in range(3)]}


def triangle_indices(indices, mode):
    if mode == 4:
        if len(indices) % 3:
            raise ValidationError("TRIANGLES index/vertex count is not divisible by three")
        return [tuple(indices[i:i + 3]) for i in range(0, len(indices), 3)]
    if mode == 5:
        return [(indices[i], indices[i + 1], indices[i + 2]) if i % 2 == 0 else
                (indices[i + 1], indices[i], indices[i + 2]) for i in range(max(0, len(indices) - 2))]
    if mode == 6:
        return [(indices[0], indices[i], indices[i + 1]) for i in range(1, len(indices) - 1)]
    if mode not in (0, 1, 2, 3):
        raise ValidationError(f"Unknown primitive mode {mode}")
    return []


def geometric_degenerate(p, tri):
    a, b, c = (p[i] for i in tri)
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    cross = [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]]
    return sum(x*x for x in cross) <= 1e-24


def validate(path, args):
    result = {"file": str(path), "name": path.name, "kind": ("creature" if path.name.lower() in args.creatures else "human") if args.kind == "auto" else args.kind,
              "errors": [], "warnings": []}
    errors, warnings = result["errors"], result["warnings"]
    glb = GLB(path)
    d, nodes = glb.doc, glb.nodes
    is_human = result["kind"] == "human"
    limit = args.human_triangles if is_human else args.creature_triangles
    result["bytes"] = len(glb.raw)
    result["size_kb_decimal"] = round(len(glb.raw) / 1000, 3)
    result["size_kib"] = round(len(glb.raw) / 1024, 3)
    result["size_target_bytes"] = args.max_bytes
    if len(glb.raw) > args.max_bytes:
        (errors if args.strict_size else warnings).append(f"Size {len(glb.raw):,} bytes exceeds target {args.max_bytes:,}")
    if glb.external_buffers:
        errors.append(f"GLB is not self-contained: external buffers {glb.external_buffers}")
    external_images = [i.get("uri") for i in d.get("images", []) if "uri" in i and not i["uri"].startswith("data:")]
    if external_images:
        errors.append(f"GLB is not self-contained: external images {external_images}")
    for i in range(len(d.get("accessors", []))):
        glb.accessor(i)  # Validate even unused binary data.
    materials = d.get("materials", [])
    used_materials = set()
    mesh_info, primitive_data = [], {}
    for mi, mesh in enumerate(d.get("meshes", [])):
        total, degenerate, vertices, primitives = 0, 0, 0, []
        for pi, p in enumerate(mesh.get("primitives", [])):
            if "KHR_draco_mesh_compression" in p.get("extensions", {}):
                raise ValidationError("Draco-compressed geometry requires decompression; not counted as verified")
            attrs = p.get("attributes", {})
            if "POSITION" not in attrs:
                raise ValidationError("Mesh primitive is missing POSITION")
            pos = glb.accessor(attrs["POSITION"])
            if d["accessors"][attrs["POSITION"]]["type"] != "VEC3":
                raise ValidationError("POSITION must be VEC3")
            for semantic, ai in attrs.items():
                if len(glb.accessor(ai)) != len(pos):
                    raise ValidationError(f"Attribute {semantic} count differs from POSITION")
            if "indices" in p:
                ia = d["accessors"][p["indices"]]
                if ia["componentType"] not in (5121, 5123, 5125) or ia["type"] != "SCALAR" or ia.get("normalized"):
                    raise ValidationError("Primitive indices must be unsigned integer SCALAR")
                indices = [r[0] for r in glb.accessor(p["indices"])]
            else:
                indices = list(range(len(pos)))
            if any(i < 0 or i >= len(pos) for i in indices):
                raise ValidationError("Primitive index is outside POSITION accessor")
            tris = triangle_indices(indices, p.get("mode", 4))
            deg = sum(geometric_degenerate(pos, t) for t in tris)
            total += len(tris)
            degenerate += deg
            vertices += len(pos)
            mat = p.get("material")
            if mat is not None:
                if not isinstance(mat, int) or not 0 <= mat < len(materials):
                    raise ValidationError("Invalid primitive material index")
                used_materials.add(mat)
            if p.get("mode", 4) not in (4, 5, 6):
                warnings.append(f"Mesh {mi} primitive {pi} is not triangular geometry")
            primitive_data[mi, pi] = (pos, sorted(set(indices)), attrs, p)
            primitives.append({"triangles": len(tris), "degenerate_triangles": deg, "vertices": len(pos), "mode": p.get("mode", 4), "material": mat})
        mesh_info.append({"name": mesh.get("name", f"mesh_{mi}"), "triangles": total, "degenerate_triangles": degenerate,
                          "vertices": vertices, "primitives": primitives})
    result["geometry"] = {"mesh_count": len(mesh_info), "triangles": sum(m["triangles"] for m in mesh_info),
                          "degenerate_triangles": sum(m["degenerate_triangles"] for m in mesh_info),
                          "triangle_limit": limit, "meshes": mesh_info}
    skins = d.get("skins", [])
    skin_matrices = {}
    skin_info = []
    for si, skin in enumerate(skins):
        joints = skin.get("joints", [])
        if not joints or len(joints) != len(set(joints)) or any(not isinstance(j, int) or not 0 <= j < len(nodes) for j in joints):
            raise ValidationError(f"Skin {si} has invalid/duplicate joints")
        ibm = glb.accessor(skin["inverseBindMatrices"]) if "inverseBindMatrices" in skin else [IDENTITY] * len(joints)
        if len(ibm) != len(joints) or any(len(m) != 16 for m in ibm):
            raise ValidationError("Inverse bind matrices do not match joints")
        skin_matrices[si] = [mul(glb.world[j], m) for j, m in zip(joints, ibm)]
        bind_error = max(abs(m[i] - IDENTITY[i]) for m in skin_matrices[si] for i in range(16))
        skin_info.append({"name": skin.get("name", f"skin_{si}"), "joint_count": len(joints),
                          "joints": [{"name": nodes[j].get("name", f"node_{j}"), "node": j,
                                      "parent": nodes[glb.parents[j]].get("name", f"node_{glb.parents[j]}") if j in glb.parents else None} for j in joints],
                          "max_joint_bind_identity_error": bind_error})
    world_points = []
    instanced_triangles = 0
    bad_weights, bad_joints = 0, 0
    for ni in sorted(glb.active):
        node = nodes[ni]
        if "mesh" not in node:
            continue
        mi = node["mesh"]
        if not 0 <= mi < len(mesh_info):
            raise ValidationError("Invalid node mesh index")
        instanced_triangles += mesh_info[mi]["triangles"]
        mesh = d["meshes"][mi]
        for pi in range(len(mesh["primitives"])):
            pos, used, attrs, primitive = primitive_data[mi, pi]
            morph_weights = node.get("weights", mesh.get("weights", []))
            if any(morph_weights):
                pos = [list(p) for p in pos]
                targets = primitive.get("targets", [])
                if len(morph_weights) != len(targets):
                    raise ValidationError("Morph weights do not match targets")
                for weight, target in zip(morph_weights, targets):
                    if weight and "POSITION" in target:
                        delta = glb.accessor(target["POSITION"])
                        if len(delta) != len(pos):
                            raise ValidationError("Morph target count differs from POSITION")
                        pos = [[p[k] + weight * v[k] for k in range(3)] for p, v in zip(pos, delta)]
            if "skin" in node:
                si = node["skin"]
                if si not in skin_matrices:
                    raise ValidationError("Invalid node skin index")
                pairs = []
                for set_index in range(8):
                    jkey, wkey = f"JOINTS_{set_index}", f"WEIGHTS_{set_index}"
                    if (jkey in attrs) != (wkey in attrs):
                        raise ValidationError("JOINTS and WEIGHTS attributes must be paired")
                    if jkey in attrs:
                        ja, wa = d["accessors"][attrs[jkey]], d["accessors"][attrs[wkey]]
                        if ja["componentType"] not in (5121, 5123) or ja.get("normalized") or ja["type"] != "VEC4" or wa["type"] != "VEC4":
                            raise ValidationError("Invalid skin joint/weight attribute format")
                        pairs.append((glb.accessor(attrs[jkey]), glb.accessor(attrs[wkey])))
                if not pairs:
                    raise ValidationError("Skinned mesh lacks JOINTS/WEIGHTS")
                matrices = skin_matrices[si]
                for vertex in used:
                    out = [0., 0., 0.]
                    weight_sum = 0.
                    for joint_rows, weight_rows in pairs:
                        for j, weight in zip(joint_rows[vertex], weight_rows[vertex]):
                            if j >= len(matrices):
                                bad_joints += 1
                                continue
                            if weight < 0:
                                bad_weights += 1
                            weight_sum += weight
                            if weight:
                                q = transform(matrices[j], pos[vertex])
                                for k in range(3):
                                    out[k] += q[k] * weight
                    if abs(weight_sum - 1.) > .005:
                        bad_weights += 1
                    world_points.append(out)
            else:
                world_points.extend(transform(glb.world[ni], pos[vertex]) for vertex in used)
    if bad_weights:
        errors.append(f"Skinning has {bad_weights} invalid or unnormalized weight rows/influences")
    if bad_joints:
        errors.append(f"Skinning has {bad_joints} out-of-range joint indices")
    result["geometry"]["active_scene_triangles"] = instanced_triangles
    result["geometry"]["nondegenerate_triangles"] = result["geometry"]["triangles"] - result["geometry"]["degenerate_triangles"]
    if max(result["geometry"]["triangles"], instanced_triangles) > limit:
        errors.append(f"Triangle count exceeds {limit:,} limit (asset {result['geometry']['triangles']:,}, scene {instanced_triangles:,})")
    if result["geometry"]["degenerate_triangles"]:
        warnings.append(f"Geometry contains {result['geometry']['degenerate_triangles']} zero-area triangles")
    if not world_points:
        errors.append("Active scene has no renderable geometry")
    result["materials"] = {"defined": len(materials), "used": len(used_materials), "names": [m.get("name", f"material_{i}") for i, m in enumerate(materials)], "texture_count": len(d.get("textures", []))}
    if args.max_materials is not None and len(used_materials) > args.max_materials:
        errors.append(f"Used material count {len(used_materials)} exceeds {args.max_materials}")
    result["rest_bounds_m"] = bounds(world_points)
    result["origin"] = {"target": "feet on Y=0, centered near X=Z=0", "ground_tolerance_m": args.origin_tolerance,
                        "scene_roots": [{"name": nodes[i].get("name", f"node_{i}"), "world_translation": glb.world[i][12:15]} for i in glb.roots]}
    if world_points:
        minimum = result["rest_bounds_m"]["min"][1]
        result["origin"]["ground_y_m"] = minimum
        result["origin"]["grounded"] = abs(minimum) <= args.origin_tolerance
        if abs(minimum) > args.origin_tolerance:
            errors.append(f"Rest geometry ground Y={minimum:.5f} m is not at feet origin (tolerance {args.origin_tolerance:.3f} m)")
    result["skins"] = skin_info
    result["humanoid"] = None
    joint_nodes = set(j for s in skins for j in s.get("joints", []))
    mapping = {}
    for ni in sorted(joint_nodes):
        bone = canonical_bone(nodes[ni].get("name", ""))
        if bone:
            if bone in mapping:
                errors.append(f"Duplicate humanoid bone mapping: {bone}")
            mapping[bone] = ni
    if is_human:
        if not skins:
            errors.append("Human has no skin/skeleton")
        missing = sorted(set(CORE_PARENTS) - set(mapping))
        chains = {}
        for bone, ni in mapping.items():
            ancestor = glb.parents.get(ni)
            parent_bone = None
            while ancestor is not None:
                cb = canonical_bone(nodes[ancestor].get("name", ""))
                if cb in CORE_PARENTS:
                    parent_bone = cb
                    break
                ancestor = glb.parents.get(ancestor)
            chains[bone] = parent_bone
            if bone in CORE_PARENTS and parent_bone != CORE_PARENTS[bone]:
                errors.append(f"Humanoid chain {bone}: expected {CORE_PARENTS[bone]}, found {parent_bone}")
        if missing:
            errors.append("Missing humanoid bones: " + ", ".join(missing))
        attachments = [i for i, n in enumerate(nodes) if n.get("name", "").lower() == "hand.r.tool"]
        attachment_ok = False
        for attachment in attachments:
            parent = glb.parents.get(attachment)
            while parent is not None:
                if parent == mapping.get("hand.R"):
                    attachment_ok = True
                    break
                parent = glb.parents.get(parent)
        if not attachment_ok:
            errors.append("Missing hand.R.tool attachment under the right hand")
        # Full actual name topology excludes optional attachment nodes, preserving
        # sensitivity to extra structural joints that affect animation reuse.
        topology = []
        for ni in sorted(joint_nodes):
            parent = glb.parents.get(ni)
            while parent is not None and parent not in joint_nodes:
                parent = glb.parents.get(parent)
            topology.append([nodes[ni].get("name", f"node_{ni}"), nodes[parent].get("name", f"node_{parent}") if parent is not None else None])
        result["humanoid"] = {"missing_bones": missing, "canonical_hierarchy": chains, "joint_name_hierarchy": sorted(topology),
                              "bone_names": {k: nodes[v].get("name") for k, v in mapping.items()}, "tool_attachment": attachment_ok}
    result["orientation"] = {"format_convention": "glTF right-handed, +Y up", "target_facing": "+Z", "visual_facing_verified": False,
                             "note": "Skeleton/landmark inference is not visual verification."}
    if all(b in mapping for b in ("head", "hips", "upper_arm.L", "upper_arm.R")):
        p = {b: glb.world[i][12:15] for b, i in mapping.items()}
        up = [p["head"][i] - p["hips"][i] for i in range(3)]
        lateral = [p["upper_arm.L"][i] - p["upper_arm.R"][i] for i in range(3)]
        front = [lateral[1]*up[2]-lateral[2]*up[1], lateral[2]*up[0]-lateral[0]*up[2], lateral[0]*up[1]-lateral[1]*up[0]]
        def unit(v):
            mag = math.sqrt(sum(x*x for x in v))
            return [x / mag for x in v] if mag else [0., 0., 0.]
        up, front = unit(up), unit(front)
        result["orientation"].update({"skeleton_up": up, "skeleton_inferred_front": front})
        if up[1] < .9:
            errors.append("Humanoid head-to-hips axis does not point +Y")
        if front[2] < .9:
            errors.append("Anatomical left/right skeleton frame does not imply facing +Z")
        if all(b in p for b in ("foot.L", "foot.R")):
            center = [(p["foot.L"][i] + p["foot.R"][i]) / 2 for i in range(3)]
            result["origin"]["foot_joint_midpoint_m"] = center
            if max(abs(center[0]), abs(center[2])) > args.horizontal_tolerance:
                errors.append(f"Foot joint midpoint X/Z {center[0]:.4f}/{center[2]:.4f} m is off center")
    else:
        result["orientation"]["skeleton_inferred_front"] = None
    # Facial mesh names are usable evidence only when separate geometry nodes
    # exist; never infer a visual feature from arbitrary vertex order.
    landmarks = []
    for ni in glb.active:
        n = nodes[ni]
        lname = n.get("name", "").lower()
        if "mesh" in n and "skin" not in n and any(token in lname for token in ("nose", "eye", "face")):
            ps = []
            for pi in range(len(d["meshes"][n["mesh"]]["primitives"])):
                pos, used, _, _ = primitive_data[n["mesh"], pi]
                ps.extend(transform(glb.world[ni], pos[v]) for v in used)
            if ps:
                landmarks.append({"name": n.get("name"), "center": [sum(p[k] for p in ps)/len(ps) for k in range(3)]})
    if landmarks:
        result["orientation"]["facial_mesh_landmarks"] = landmarks
    clips = []
    for ai, animation in enumerate(d.get("animations", [])):
        name = animation.get("name", f"animation_{ai}")
        starts, ends, channels, sampler_times = [], [], [], {}
        for si, sampler in enumerate(animation.get("samplers", [])):
            times_a = d["accessors"][sampler["input"]]
            if times_a["type"] != "SCALAR" or times_a["componentType"] != 5126:
                raise ValidationError(f"Animation {name}: key times must be float SCALAR")
            times = [r[0] for r in glb.accessor(sampler["input"])]
            if not times or times[0] < 0 or any(b <= a for a, b in zip(times, times[1:])):
                raise ValidationError(f"Animation {name}: key times must be nonnegative and strictly increasing")
            interpolation = sampler.get("interpolation", "LINEAR")
            if interpolation not in ("LINEAR", "STEP", "CUBICSPLINE"):
                raise ValidationError(f"Animation {name}: invalid interpolation")
            sampler_times[si] = times
        seen_channels, loop_errors = set(), []
        for channel in animation.get("channels", []):
            si = channel["sampler"]
            if si not in sampler_times:
                raise ValidationError(f"Animation {name}: invalid sampler")
            sampler, target = animation["samplers"][si], channel["target"]
            ni, target_path = target.get("node"), target.get("path")
            if not isinstance(ni, int) or not 0 <= ni < len(nodes) or target_path not in ("translation", "rotation", "scale", "weights"):
                raise ValidationError(f"Animation {name}: invalid channel target")
            if (ni, target_path) in seen_channels:
                errors.append(f"Animation {name}: duplicate target channel")
            seen_channels.add((ni, target_path))
            if "matrix" in nodes[ni] and target_path != "weights":
                errors.append(f"Animation {name}: TRS animation targets a matrix node")
            values = glb.accessor(sampler["output"])
            output_a = d["accessors"][sampler["output"]]
            factor = 3 if sampler.get("interpolation") == "CUBICSPLINE" else 1
            expected_type = {"translation": "VEC3", "rotation": "VEC4", "scale": "VEC3", "weights": "SCALAR"}[target_path]
            multiplier = 1
            if target_path == "weights":
                mesh = d["meshes"][nodes[ni]["mesh"]]
                multiplier = len(mesh["primitives"][0].get("targets", []))
            if output_a["type"] != expected_type or len(values) != len(sampler_times[si])*factor*multiplier:
                errors.append(f"Animation {name}: output count/type mismatch for {target_path}")
            elif values:
                if target_path == "rotation":
                    key_values = values[1::3] if factor == 3 else values
                    if any(abs(sum(v*v for v in q)-1) > .005 for q in key_values):
                        errors.append(f"Animation {name}: non-unit keyframe quaternion")
                first_index, last_index = (multiplier, len(values) - 2*multiplier) if factor == 3 else (0, len(values) - multiplier)
                first, last = values[first_index:first_index+multiplier], values[last_index:last_index+multiplier]
                difference = max(abs(a-b) for r, s in zip(first, last) for a, b in zip(r, s))
                if target_path == "rotation":
                    difference = min(difference, max(abs(a+b) for r, s in zip(first, last) for a, b in zip(r, s)))
                loop_errors.append(difference)
            times = sampler_times[si]
            starts.append(times[0]); ends.append(times[-1])
            channels.append({"node": nodes[ni].get("name", f"node_{ni}"), "path": target_path, "keyframes": len(times), "interpolation": sampler.get("interpolation", "LINEAR")})
        if not channels:
            errors.append(f"Animation {name} has no channels")
        duration = max(ends) - min(starts) if starts else 0.
        if starts and abs(min(starts)) > args.duration_tolerance:
            errors.append(f"Animation {name} starts at {min(starts):.4f}s instead of zero")
        clips.append({"name": name, "start_s": min(starts) if starts else 0., "end_s": max(ends) if ends else 0.,
                      "duration_s": duration, "channel_count": len(channels), "channels": channels,
                      "max_first_last_component_difference": max(loop_errors, default=0.), "loop_endpoints_match": max(loop_errors, default=0.) <= .005})
    result["animations"] = clips
    lookup = {c["name"].lower(): c for c in clips}
    if len(lookup) != len(clips):
        errors.append("Animation clip names are duplicated (case-insensitive)")
    required = HUMAN_ANIMATIONS if is_human else {"idle": None, "walk": None, "special": None}
    for name, duration in required.items():
        if name not in lookup:
            errors.append(f"Missing required animation: {name}")
        elif duration is not None and abs(lookup[name]["duration_s"] - duration) > args.duration_tolerance:
            errors.append(f"Animation {name}: duration {lookup[name]['duration_s']:.4f}s, expected {duration:g}s")
    for c in clips:
        if c["name"].lower() in ("idle", "walk", "run") and not c["loop_endpoints_match"]:
            warnings.append(f"Animation {c['name']}: first/last key values differ; loop seam needs review")
    result["status"] = "FAIL" if errors else "PASS"
    return result


def compare_humans(results):
    humans = [r for r in results if r.get("kind") == "human" and r.get("humanoid")]
    if not humans:
        return {"status": "not_applicable", "checked": 0}
    reference = humans[0]
    compatible = True
    for r in humans[1:]:
        if r["humanoid"]["joint_name_hierarchy"] != reference["humanoid"]["joint_name_hierarchy"]:
            r["errors"].append(f"Human joint name/hierarchy differs from {reference['name']}")
            r["status"] = "FAIL"
            compatible = False
    return {"status": "PASS" if compatible else "FAIL", "reference": reference["name"], "checked": len(humans),
            "meaning": "Identical skin-joint names and nearest joint parents; per-file core chains checked separately. Rest proportions may differ."}


def write_glb_for_test(path, doc, binary=b""):
    j = json.dumps(doc, separators=(",", ":")).encode()
    j += b" " * (-len(j) % 4)
    b = binary + b"\0" * (-len(binary) % 4)
    chunks = struct.pack("<I4s", len(j), b"JSON") + j
    if binary:
        chunks += struct.pack("<I4s", len(b), b"BIN\0") + b
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks)


def self_test():
    """Small generated fixtures catch parser, math, count, skin and clip regressions."""
    assert transform(mul(node_matrix({"translation": [3., 0., 0.]}), node_matrix({"scale": [2., 2., 2.]})), (1., 0., 0.)) == (5., 0., 0.)
    assert canonical_bone("UpperArm.L") == "upper_arm.L"
    assert canonical_bone("LeftForeArm") == "lower_arm.L"
    assert canonical_bone("mixamorig:RightUpLeg") == "upper_leg.R"
    assert len(triangle_indices([0, 1, 2, 3], 5)) == 2
    assert len(triangle_indices([0, 1, 2, 3], 6)) == 2
    with tempfile.TemporaryDirectory() as td:
        path = pathlib.Path(td) / "test.glb"
        # Interleaved positions, uint16 indices, decoded time data, and normalized
        # sparse weights, deliberately without trusted accessor min/max values.
        binary = b"".join(struct.pack("<4f", *p) for p in ((0, 0, 0, 99), (1, 0, 0, 99), (0, 1, 0, 99)))
        binary += struct.pack("<3H", 0, 1, 2) + b"\0\0"
        binary += struct.pack("<2f", 0., 1.) + struct.pack("<6f", 0., 0., 0., 0., 0., 0.)
        binary += b"\x01\0\0\0" + bytes([255, 0, 0, 0])
        doc = {"asset": {"version": "2.0"}, "buffers": [{"byteLength": len(binary)}],
               "bufferViews": [{"buffer": 0, "byteLength": 48, "byteStride": 16},
                               {"buffer": 0, "byteOffset": 48, "byteLength": 6},
                               {"buffer": 0, "byteOffset": 56, "byteLength": 8},
                               {"buffer": 0, "byteOffset": 64, "byteLength": 24},
                               {"buffer": 0, "byteOffset": 88, "byteLength": 1},
                               {"buffer": 0, "byteOffset": 92, "byteLength": 4}],
               "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [-999]*3, "max": [999]*3},
                             {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"},
                             {"bufferView": 2, "componentType": 5126, "count": 2, "type": "SCALAR"},
                             {"bufferView": 3, "componentType": 5126, "count": 2, "type": "VEC3"},
                             {"componentType": 5121, "count": 3, "type": "VEC4", "normalized": True,
                              "sparse": {"count": 1, "indices": {"bufferView": 4, "componentType": 5121}, "values": {"bufferView": 5}}}],
               "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
               "nodes": [{"mesh": 0}, {"mesh": 0, "translation": [2, 0, 0]}],
               "scenes": [{"nodes": [0, 1]}], "scene": 0,
               "animations": [{"name": name, "samplers": [{"input": 2, "output": 3}], "channels": [{"sampler": 0, "target": {"node": 0, "path": "translation"}}]} for name in ("idle", "walk", "special")]}
        write_glb_for_test(path, doc, binary)
        glb = GLB(path)
        assert glb.accessor(0)[1] == (1., 0., 0.)
        assert glb.accessor(4) == [(0.,)*4, (1., 0., 0., 0.), (0.,)*4]
        args = parser().parse_args([])
        args.creatures = CREATURES
        args.kind = "creature"
        r = validate(path, args)
        assert r["status"] == "PASS", r["errors"]
        assert r["geometry"]["triangles"] == 1
        assert r["geometry"]["active_scene_triangles"] == 2
        assert r["rest_bounds_m"]["max"] == [3., 1., 0.]
        assert r["animations"][0]["duration_s"] == 1.
        # A valid joint translated in world with an inverse bind cancels to rest.
        joints = bytes([0, 0, 0, 0])*3
        weights = struct.pack("<12f", *([1., 0., 0., 0.]*3))
        ibm = list(IDENTITY); ibm[12] = -5.
        for data, ct, count, tp in ((joints, 5121, 3, "VEC4"), (weights, 5126, 3, "VEC4"), (struct.pack("<16f", *ibm), 5126, 1, "MAT4")):
            offset = len(binary); binary += data
            doc["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
            doc["accessors"].append({"bufferView": len(doc["bufferViews"])-1, "componentType": ct, "count": count, "type": tp})
        doc["buffers"][0]["byteLength"] = len(binary)
        doc["nodes"] = [{"mesh": 0, "skin": 0}, {"name": "joint", "translation": [5, 0, 0]}]
        doc["skins"] = [{"joints": [1], "inverseBindMatrices": 7}]
        doc["meshes"][0]["primitives"][0]["attributes"].update({"JOINTS_0": 5, "WEIGHTS_0": 6})
        write_glb_for_test(path, doc, binary)
        r = validate(path, args)
        assert r["status"] == "PASS", r["errors"]
        assert r["rest_bounds_m"]["max"] == [1., 1., 0.]
        assert r["skins"][0]["max_joint_bind_identity_error"] == 0.
        # Catch corrupt declared length, out-of-range indices and nonmonotonic time.
        raw = path.read_bytes(); path.write_bytes(raw + b"x")
        try:
            GLB(path)
            raise AssertionError("Malformed length was accepted")
        except ValidationError:
            pass
        damaged = bytearray(binary); struct.pack_into("<H", damaged, 48, 99)
        write_glb_for_test(path, doc, damaged)
        try:
            validate(path, args)
            raise AssertionError("Invalid index was accepted")
        except ValidationError:
            pass
        damaged = bytearray(binary); struct.pack_into("<2f", damaged, 56, 1., 0.)
        write_glb_for_test(path, doc, damaged)
        try:
            validate(path, args)
            raise AssertionError("Invalid time order was accepted")
        except ValidationError:
            pass
    print("Self-tests PASS: GLB parsing, TRS, interleaved/sparse/normalized accessors, triangle modes, scene instances, skinning, bounds, clips, malformed data.")


def parser():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("paths", nargs="*", type=pathlib.Path, help="GLB files/directories; defaults to sibling models directory")
    p.add_argument("--json", type=pathlib.Path, dest="json_path", help="Write full machine-readable report")
    p.add_argument("--kind", choices=("auto", "human", "creature"), default="auto")
    p.add_argument("--creature", action="append", default=[], help="Additional creature filename (repeatable)")
    p.add_argument("--human-triangles", type=int, default=4000)
    p.add_argument("--creature-triangles", type=int, default=2000)
    p.add_argument("--max-bytes", type=int, default=300000, help="Size target, decimal bytes (default 300000)")
    p.add_argument("--strict-size", action="store_true", help="Treat size target excess as failure instead of warning")
    p.add_argument("--max-materials", type=int, default=None, help="Optional used-material limit")
    p.add_argument("--duration-tolerance", type=float, default=.03)
    p.add_argument("--origin-tolerance", type=float, default=.02, help="Maximum ground height error in meters")
    p.add_argument("--horizontal-tolerance", type=float, default=.15, help="Maximum human foot-midpoint X/Z displacement in meters")
    p.add_argument("--self-test", action="store_true")
    return p


def main():
    args = parser().parse_args()
    if args.self_test:
        self_test()
        return 0
    if min(args.human_triangles, args.creature_triangles, args.max_bytes, args.duration_tolerance, args.origin_tolerance, args.horizontal_tolerance) < 0:
        parser().error("Limits and tolerances must not be negative")
    args.creatures = CREATURES | {pathlib.Path(n).name.lower() for n in args.creature}
    paths = args.paths or [pathlib.Path(__file__).resolve().parent / "models"]
    files = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(p for p in path.rglob("*") if p.is_file() and p.suffix.lower() == ".glb"))
        elif path.is_file():
            files.append(path)
        else:
            print(f"Input not found: {path}", file=sys.stderr)
            return 2
    files = list(dict.fromkeys(p.resolve() for p in files))
    if not files:
        print("No GLB files found.", file=sys.stderr)
        return 2
    results = []
    for path in files:
        try:
            results.append(validate(path, args))
        except (ValidationError, OSError, KeyError, IndexError, TypeError, ValueError, struct.error) as exc:
            results.append({"file": str(path), "name": path.name, "status": "FAIL", "errors": [f"Malformed/unsupported GLB: {exc}"], "warnings": []})
    compatibility = compare_humans(results)
    failed = sum(r["status"] == "FAIL" for r in results)
    report = {"validator_version": VERSION, "status": "FAIL" if failed else "PASS", "passed": len(results)-failed, "failed": failed,
              "human_hierarchy_compatibility": compatibility, "models": results,
              "limitations": ["Facing is inferred from named skeleton landmarks where possible; inspect renders for visual +Z facing.",
                              "Bind/rest geometry bounds do not guarantee animation-time ground contact or freedom from clipping.",
                              "Exact clip names and human durations are checked; movement quality requires a visual preview.",
                              "This is a focused asset QA validator, not a substitute for the Khronos glTF schema validator."]}
    for r in results:
        g = r.get("geometry", {})
        print(f"{r['status']:4} {r['name']:24} {g.get('triangles', '?'):>5} tris  {r.get('bytes', '?'):>7} bytes  {r.get('materials', {}).get('used', '?')} materials")
        for c in r.get("animations", []):
            print(f"     {c['name']}: {c['duration_s']:.3f}s, {c['channel_count']} channels")
        for message in r["errors"]:
            print("     ERROR: " + message)
        for message in r["warnings"]:
            print("     WARN:  " + message)
    print(f"\n{report['status']}: {len(results)-failed}/{len(results)} models passed. Human hierarchy comparison: {compatibility['status']}.")
    print("Facing and motion quality still require visual review.")
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        print(f"Full report: {args.json_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
