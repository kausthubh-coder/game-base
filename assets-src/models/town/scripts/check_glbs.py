#!/usr/bin/env python3
"""Independently validate Hollowmere's delivered GLB bytes.

Usage: python scripts/check_glbs.py [pack_root] [--skip-renders]
Reports: reports/glb_validation.json and reports/glb_validation.md.
This is a delivery-contract check, not a substitute for a full Khronos validator
or visual review. Source .blend files are checked for existence and file header.
Zstandard-compressed Blender sources require the Python zstandard package.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import json
import math
from pathlib import Path
import struct
import sys
import zlib


LIMITS = {"landmark": 8000, "building": 4000, "street": 800}
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
              5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
SHAPES = {"SCALAR": (1, 1), "VEC2": (1, 2), "VEC3": (1, 3),
          "VEC4": (1, 4), "MAT2": (2, 2), "MAT3": (3, 3), "MAT4": (4, 4)}
IDENTITY = (1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.)
VIEWS = ("front", "three-quarter", "night")
SIZE_LIMIT = 400000  # Strict decimal 400 kB, not 400 KiB.


class InvalidGLB(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidGLB(message)


def finite(values):
    return all(isinstance(x, (int, float)) and not isinstance(x, bool)
               and math.isfinite(x) for x in values)


def integer(value, message):
    require(isinstance(value, int) and not isinstance(value, bool), message)
    return value


def at(items, index, label):
    integer(index, f"{label}: index is not an integer")
    require(0 <= index < len(items), f"{label}: index {index} out of range")
    return items[index]


def category_key(value):
    key = str(value).lower().replace("-", "_").replace(" ", "_")
    return {"landmarks": "landmark", "buildings": "building", "props": "street",
            "prop": "street", "street_props": "street", "street_prop": "street"}.get(key, key)


def blend_header(path):
    """Read an actual Blender header through supported source compression."""
    with path.open('rb') as stream:
        magic = stream.read(4)
        stream.seek(0)
        if magic == b'\x28\xb5\x2f\xfd':
            try:
                import zstandard
            except ImportError as exc:
                raise InvalidGLB('Zstandard source requires Python zstandard package') from exc
            try:
                with zstandard.ZstdDecompressor().stream_reader(stream) as reader:
                    header = reader.read(12)
            except zstandard.ZstdError as exc:
                raise InvalidGLB(f'invalid Zstandard source: {exc}') from exc
            compression = 'zstandard'
        elif magic[:2] == b'\x1f\x8b':
            with gzip.GzipFile(fileobj=stream) as reader:
                header = reader.read(12)
            compression = 'gzip'
        else:
            header = stream.read(12)
            compression = 'none'
    require(len(header) == 12 and header[:7] == b'BLENDER'
            and header[7:8] in (b'_', b'-') and header[8:9] in (b'v', b'V')
            and header[9:].isdigit(), 'missing/unrecognized .blend header')
    return {'bytes': path.stat().st_size, 'version_header': header[9:].decode('ascii'),
            'compression': compression}


def matrix_multiply(a, b):
    # glTF matrices are column major.
    return tuple(sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4))
                 for col in range(4) for row in range(4))


def node_matrix(node):
    if "matrix" in node:
        require(not any(k in node for k in ("translation", "rotation", "scale")),
                "node has both matrix and TRS")
        mat = node["matrix"]
        require(len(mat) == 16 and finite(mat), "node matrix is invalid/non-finite")
        require(all(abs(mat[i]) <= 1e-6 for i in (3, 7, 11)) and abs(mat[15] - 1) <= 1e-6,
                "node matrix is not affine")
        return tuple(mat)
    t, r, s = node.get("translation", [0, 0, 0]), node.get("rotation", [0, 0, 0, 1]), node.get("scale", [1, 1, 1])
    require(len(t) == 3 and len(r) == 4 and len(s) == 3 and finite(t + r + s),
            "node TRS is invalid/non-finite")
    x, y, z, w = r
    require(abs(sum(v * v for v in r) - 1) <= 1e-4, "node rotation quaternion is not normalized")
    return ((1-2*y*y-2*z*z)*s[0], (2*x*y+2*z*w)*s[0], (2*x*z-2*y*w)*s[0], 0,
            (2*x*y-2*z*w)*s[1], (1-2*x*x-2*z*z)*s[1], (2*y*z+2*x*w)*s[1], 0,
            (2*x*z+2*y*w)*s[2], (2*y*z-2*x*w)*s[2], (1-2*x*x-2*y*y)*s[2], 0,
            t[0], t[1], t[2], 1)


def transform(mat, point):
    return tuple(sum(mat[col * 4 + row] * point[col] for col in range(3)) + mat[12 + row]
                 for row in range(3))


def extension_names(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ("extensionsUsed", "extensionsRequired"):
                yield from child
            elif key == "extensions":
                yield from child.keys()
            yield from extension_names(child)
    elif isinstance(value, list):
        for child in value:
            yield from extension_names(child)


class GLB:
    def __init__(self, path):
        self.raw = path.read_bytes()
        require(len(self.raw) >= 20, "file is shorter than the GLB header and first chunk")
        magic, version, length = struct.unpack_from("<4sII", self.raw)
        require(magic == b"glTF", "GLB magic is not glTF")
        require(version == 2, f"GLB version {version}, expected 2")
        require(length == len(self.raw), f"header length {length} != actual {len(self.raw)}")
        chunks, offset = [], 12
        while offset < length:
            require(offset + 8 <= length, "truncated chunk header")
            size, kind = struct.unpack_from("<II", self.raw, offset)
            require(size % 4 == 0, "chunk length is not four-byte aligned")
            offset += 8
            require(offset + size <= length, "chunk extends beyond the file")
            chunks.append((kind, self.raw[offset:offset + size]))
            offset += size
        require(len(chunks) == 2, f"expected JSON + BIN chunks, found {len(chunks)}")
        require(chunks[0][0] == 0x4E4F534A and chunks[1][0] == 0x004E4942,
                "chunks must be JSON followed by BIN")
        self.doc = json.loads(chunks[0][1].decode("utf-8"), parse_constant=lambda x: (_ for _ in ()).throw(InvalidGLB(f"non-finite JSON value {x}")))
        require(isinstance(self.doc, dict), "GLB JSON must be an object")
        self.bin = chunks[1][1]
        self.cache = {}
        require(self.doc.get("asset", {}).get("version") == "2.0", "asset.version must be 2.0")
        buffers = self.doc.get("buffers", [])
        require(len(buffers) == 1 and "uri" not in buffers[0], "requires one embedded buffer and no buffer URI")
        self.buffer_length = integer(buffers[0].get("byteLength"), "buffer byteLength must be an integer")
        require(0 < self.buffer_length <= len(self.bin) <= self.buffer_length + 3,
                "buffer byteLength disagrees with BIN chunk")
        require(all(v == 0 for v in self.bin[self.buffer_length:]), "BIN padding must be zero")

    def view(self, index):
        return at(self.doc.get("bufferViews", []), index, "bufferView")

    def accessor(self, index):
        return at(self.doc.get("accessors", []), index, "accessor")

    def validate_layout(self):
        views = self.doc.get("bufferViews", [])
        for i, view in enumerate(views):
            require(view.get("buffer") == 0, f"bufferView {i}: buffer must be 0")
            start = integer(view.get("byteOffset", 0), f"bufferView {i}: invalid offset")
            size = integer(view.get("byteLength"), f"bufferView {i}: invalid length")
            require(start >= 0 and size > 0 and start + size <= self.buffer_length,
                    f"bufferView {i}: bytes outside embedded buffer")
            if "byteStride" in view:
                stride = integer(view["byteStride"], f"bufferView {i}: invalid stride")
                require(4 <= stride <= 252 and stride % 4 == 0, f"bufferView {i}: invalid byteStride {stride}")
        for i in range(len(self.doc.get("accessors", []))):
            self.values(i)  # Every accessor, including any not referenced by the mesh.

    def values(self, index):
        if index in self.cache:
            return self.cache[index]
        acc = self.accessor(index)
        count = integer(acc.get("count"), f"accessor {index}: invalid count")
        require(count > 0, f"accessor {index}: count must be positive")
        component = acc.get("componentType")
        require(component in COMPONENTS, f"accessor {index}: invalid component type")
        require(acc.get("type") in SHAPES, f"accessor {index}: invalid type")
        fmt, size = COMPONENTS[component]
        columns, rows = SHAPES[acc["type"]]
        column_stride = rows * size
        if columns > 1:
            column_stride = (column_stride + 3) // 4 * 4
        offsets = [col * column_stride + row * size for col in range(columns) for row in range(rows)]
        element_size = columns * column_stride
        offset = integer(acc.get("byteOffset", 0), f"accessor {index}: invalid byteOffset")
        require(offset >= 0 and offset % size == 0, f"accessor {index}: unaligned offset")
        require(not acc.get("normalized", False) or component in (5120, 5121, 5122, 5123),
                f"accessor {index}: invalid normalized component type")

        def read_view(view_index, byte_offset, n, layout, unpack_fmt, element_bytes, component_size, allow_stride):
            view = self.view(view_index)
            view_start = view.get("byteOffset", 0)
            stride = view.get("byteStride", element_bytes) if allow_stride else element_bytes
            require(allow_stride or "byteStride" not in view, f"accessor {index}: sparse bufferView cannot have stride")
            require(stride >= element_bytes and stride % component_size == 0,
                    f"accessor {index}: stride is smaller than/unaligned to element")
            require(byte_offset >= 0 and byte_offset % component_size == 0
                    and (view_start + byte_offset) % component_size == 0,
                    f"accessor {index}: unaligned buffer position")
            require(byte_offset + (n - 1) * stride + element_bytes <= view["byteLength"],
                    f"accessor {index}: values exceed bufferView range")
            return [tuple(struct.unpack_from("<" + unpack_fmt, self.bin, view_start + byte_offset + j * stride + k)[0]
                          for k in layout) for j in range(n)]

        if "bufferView" in acc:
            values = read_view(acc["bufferView"], offset, count, offsets, fmt, element_size, size, True)
        else:
            require(offset == 0 and "sparse" in acc, f"accessor {index}: missing base bufferView and sparse data")
            values = [tuple(0 for _ in offsets)] * count
        if "sparse" in acc:
            sparse = acc["sparse"]
            n = integer(sparse.get("count"), f"accessor {index}: invalid sparse count")
            require(0 < n <= count, f"accessor {index}: sparse count outside accessor")
            inds, vals = sparse["indices"], sparse["values"]
            ct = inds.get("componentType")
            require(ct in (5121, 5123, 5125), f"accessor {index}: invalid sparse index type")
            sfmt, ssize = COMPONENTS[ct]
            sparse_ids = [x[0] for x in read_view(inds["bufferView"], inds.get("byteOffset", 0), n, [0], sfmt, ssize, ssize, False)]
            require(all(0 <= x < count for x in sparse_ids) and all(a < b for a, b in zip(sparse_ids, sparse_ids[1:])),
                    f"accessor {index}: sparse indices out of order/range")
            sparse_vals = read_view(vals["bufferView"], vals.get("byteOffset", 0), n, offsets, fmt, element_size, size, False)
            for i, value in zip(sparse_ids, sparse_vals):
                values[i] = value
        require(all(finite(value) for value in values), f"accessor {index}: non-finite component")
        if acc.get("normalized", False):
            maximum = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[component]
            values = [tuple(max(-1., x / maximum) if component in (5120, 5122) else x / maximum for x in v) for v in values]
        for bound in ("min", "max"):
            if bound in acc:
                require(len(acc[bound]) == len(offsets) and finite(acc[bound]), f"accessor {index}: invalid {bound}")
        self.cache[index] = values
        return values


def check_png(path):
    data = path.read_bytes()
    require(data[:8] == b"\x89PNG\r\n\x1a\n", f"{path.name}: invalid PNG signature")
    offset, seen_idat, dimensions, seen_iend = 8, False, None, False
    while offset < len(data):
        require(offset + 12 <= len(data), f"{path.name}: truncated PNG chunk")
        length = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4:offset + 8]
        end = offset + 8 + length
        require(end + 4 <= len(data), f"{path.name}: truncated PNG data")
        require(zlib.crc32(data[offset + 4:end]) & 0xffffffff == struct.unpack_from(">I", data, end)[0],
                f"{path.name}: PNG CRC mismatch")
        if dimensions is None:
            require(kind == b"IHDR" and length == 13, f"{path.name}: missing IHDR")
            dimensions = list(struct.unpack_from(">II", data, offset + 8))
            require(min(dimensions) > 0, f"{path.name}: invalid dimensions")
        if kind == b"IDAT":
            seen_idat = True
        if kind == b"IEND":
            require(length == 0 and end + 4 == len(data), f"{path.name}: invalid IEND/trailing bytes")
            seen_iend = True
            break
        offset = end + 4
    require(seen_idat and seen_iend, f"{path.name}: incomplete PNG")
    return {"bytes": len(data), "dimensions": dimensions}


def check_asset(root, record, args):
    name = record.get("name", "<unnamed>")
    result = {"name": name, "category": record.get("category"), "status": "fail", "errors": [], "warnings": []}

    def check(condition, message):
        if not condition:
            result["errors"].append(message)

    def stage(label, function):
        try:
            return function()
        except (InvalidGLB, OSError, EOFError, ValueError, TypeError, KeyError, IndexError, struct.error, OverflowError) as exc:
            result["errors"].append(f"{label}: {exc}")
            return None

    if not isinstance(name, str) or not name or Path(name).name != name or name in (".", ".."):
        result["errors"].append("unsafe or missing asset name")
        return result
    path = root / "models" / f"{name}.glb"
    glb = stage("GLB container", lambda: GLB(path))
    if glb:
        result["bytes"] = len(glb.raw)
        check(len(glb.raw) < SIZE_LIMIT, f"file is {len(glb.raw)} bytes; must be below {SIZE_LIMIT}")
        check(record.get("bytes") == len(glb.raw), f"manifest bytes {record.get('bytes')} != actual {len(glb.raw)}")
        doc = glb.doc
        check(not doc.get("images") and not doc.get("textures") and not doc.get("samplers"), "images, textures, or samplers present")
        extensions = sorted(set(extension_names(doc)))
        result["extensions"] = extensions
        check("KHR_draco_mesh_compression" not in extensions, "Draco compression present")
        check("EXT_meshopt_compression" not in extensions, "meshopt compression present")
        check(not doc.get("animations") and not doc.get("skins"), "animations or skins present in static asset")
        check(not doc.get("cameras") and "KHR_lights_punctual" not in extensions, "camera or light present in mesh export")
        layout_ok = stage("binary layout", lambda: (glb.validate_layout(), True)[1])
        materials = doc.get("materials", [])
        names = [m.get("name") for m in materials]
        result["materials"] = names
        check(names.count("Body") == 1 and set(names).issubset({"Body", "Glow"}) and len(names) == len(set(names)),
              f"materials must be Body and optionally Glow, found {names}")
        for i, mat in enumerate(materials):
            check(mat.get("alphaMode", "OPAQUE") == "OPAQUE", f"material {i} is not OPAQUE")
            factor = mat.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])
            valid_factor = len(factor) == 4 and finite(factor)
            check(valid_factor, f"material {i} baseColorFactor invalid")
            if valid_factor:
                check(abs(factor[3] - 1) < 1e-6, f"material {i} has alpha != 1")
                if mat.get("name") == "Body":
                    check(all(abs(x - 1) < 1e-6 for x in factor), "Body baseColorFactor must be white")
            if mat.get("name") == "Glow":
                emission = mat.get("emissiveFactor", [0, 0, 0])
                strength = mat.get("extensions", {}).get("KHR_materials_emissive_strength", {}).get("emissiveStrength", 1)
                check(len(emission) == 3 and finite(emission) and max(emission) > 0
                      and finite([strength]) and strength > 0, "Glow must have positive emission")
        meshes, nodes = doc.get("meshes", []), doc.get("nodes", [])
        check(len(meshes) == 1, f"expected one merged mesh, found {len(meshes)}")
        mesh_nodes = [i for i, node in enumerate(nodes) if "mesh" in node]
        check(len(mesh_nodes) == 1, f"expected one mesh node, found {len(mesh_nodes)}")

        def geometry():
            require(layout_ok, "cannot measure invalid accessor layout")
            require(len(meshes) == 1 and len(mesh_nodes) == 1, "requires one mesh and one mesh instance")
            scene = at(doc.get("scenes", []), doc.get("scene", 0), "default scene")
            parents, worlds, visiting = {}, {}, set()
            for i, node in enumerate(nodes):
                for child in node.get("children", []):
                    at(nodes, child, "child node")
                    require(child not in parents, "node has multiple parents")
                    parents[child] = i

            def visit(index, parent):
                require(index not in visiting and index not in worlds, "node graph cycle or duplicate scene root")
                node = at(nodes, index, "scene node")
                visiting.add(index)
                local = node_matrix(node)
                worlds[index] = matrix_multiply(parent, local)
                for child in node.get("children", []):
                    visit(child, worlds[index])
                visiting.remove(index)

            for index in scene.get("nodes", []):
                require(index not in parents, "scene root has a parent")
                visit(index, IDENTITY)
            mi = mesh_nodes[0]
            require(mi in worlds, "mesh is not reachable in default scene")
            node = nodes[mi]
            require(node["mesh"] == 0, "mesh node references invalid mesh")
            world, local = worlds[mi], node_matrix(node)
            check(all(abs(a-b) <= 2e-5 for a, b in zip(local, IDENTITY)), "mesh local transform is not baked/identity")
            check(all(abs(a-b) <= 2e-5 for a, b in zip(world, IDENTITY)), "mesh world transform is not baked/identity")
            result["node_world_matrix"] = [round(v, 7) for v in world]
            mins, maxs = [math.inf] * 3, [-math.inf] * 3
            triangles, vertex_count, used_materials, primitive_counts, body_colors = 0, 0, set(), {}, []
            require(meshes[0].get("primitives"), "mesh has no primitives")
            for i, primitive in enumerate(meshes[0]["primitives"]):
                require(primitive.get("mode", 4) == 4, f"primitive {i}: must use TRIANGLES")
                require(not primitive.get("targets"), f"primitive {i}: morph targets present")
                require("indices" in primitive, f"primitive {i}: indexed triangles required")
                attrs = primitive.get("attributes", {})
                require("POSITION" in attrs and "NORMAL" in attrs, f"primitive {i}: missing POSITION/NORMAL")
                pa, na = glb.accessor(attrs["POSITION"]), glb.accessor(attrs["NORMAL"])
                require(pa["type"] == "VEC3" and pa["componentType"] == 5126, f"primitive {i}: POSITION must be float VEC3")
                quantized_normal = na["componentType"] in (5120, 5122)
                require(na["type"] == "VEC3" and (na["componentType"] == 5126 or quantized_normal),
                        f"primitive {i}: NORMAL must be float or signed normalized VEC3")
                if quantized_normal:
                    require(na.get("normalized", False), f"primitive {i}: integer NORMAL must be normalized")
                    require("KHR_mesh_quantization" in glb.doc.get("extensionsUsed", [])
                            and "KHR_mesh_quantization" in glb.doc.get("extensionsRequired", []),
                            f"primitive {i}: integer NORMAL requires KHR_mesh_quantization")
                require("min" in pa and "max" in pa, f"primitive {i}: POSITION min/max missing")
                positions, normals = glb.values(attrs["POSITION"]), glb.values(attrs["NORMAL"])
                require(len(positions) == len(normals), f"primitive {i}: POSITION/NORMAL counts differ")
                for attribute, acc_index in attrs.items():
                    require(glb.accessor(acc_index)["count"] == len(positions), f"primitive {i}: {attribute} count differs from POSITION")
                actual_min = [min(p[k] for p in positions) for k in range(3)]
                actual_max = [max(p[k] for p in positions) for k in range(3)]
                check(all(abs(pa["min"][k] - actual_min[k]) < 1e-4 and abs(pa["max"][k] - actual_max[k]) < 1e-4 for k in range(3)),
                      f"primitive {i}: POSITION accessor bounds disagree with binary values")
                check(all(abs(sum(v*v for v in normal)-1) < 0.015 for normal in normals), f"primitive {i}: non-unit or zero normals")
                ia = glb.accessor(primitive["indices"])
                require(ia["type"] == "SCALAR" and ia["componentType"] in (5121, 5123, 5125)
                        and not ia.get("normalized", False), f"primitive {i}: invalid index accessor")
                indices = [x[0] for x in glb.values(primitive["indices"])]
                require(len(indices) % 3 == 0, f"primitive {i}: index count not divisible by three")
                require(all(0 <= x < len(positions) for x in indices), f"primitive {i}: vertex index out of range")
                mat_id = primitive.get("material")
                mat = at(materials, mat_id, f"primitive {i} material")
                used_materials.add(mat_id)
                mat_name = mat.get("name", "<unnamed>")
                tris = len(indices) // 3
                triangles += tris
                primitive_counts[mat_name] = primitive_counts.get(mat_name, 0) + tris
                vertex_count += len(positions)
                if mat_name != "Glow":
                    require("COLOR_0" in attrs, f"primitive {i}: Body requires COLOR_0")
                if "COLOR_0" in attrs:
                    ca = glb.accessor(attrs["COLOR_0"])
                    require(ca["type"] in ("VEC3", "VEC4") and ca["componentType"] in (5121, 5123, 5126),
                            f"primitive {i}: invalid COLOR_0 format")
                    require(ca["componentType"] == 5126 or ca.get("normalized", False), f"primitive {i}: integer colors must be normalized")
                    colors = glb.values(attrs["COLOR_0"])
                    check(all(all(-1e-6 <= x <= 1 + 1e-6 for x in c) for c in colors), f"primitive {i}: COLOR_0 outside [0,1]")
                    check(all(len(c) == 3 or abs(c[3] - 1) < 1e-6 for c in colors), f"primitive {i}: vertex alpha is not opaque")
                    if mat_name != "Glow":
                        check(all(max(c[:3]) > 1e-6 for c in colors), f"primitive {i}: black Body vertex colors")
                        body_colors.extend(c[:3] for c in colors)
                # Measure every exported vertex, not just referenced vertices.
                for position in positions:
                    point = transform(world, position)
                    for k in range(3):
                        mins[k], maxs[k] = min(mins[k], point[k]), max(maxs[k], point[k])
            check(used_materials == set(range(len(materials))), "unused material slots exported")
            dimensions = [maxs[k] - mins[k] for k in range(3)]
            center = [(maxs[k] + mins[k]) / 2 for k in range(3)]
            result.update({"triangles": triangles, "vertices_exported": vertex_count,
                           "bounds_min": [round(v, 6) for v in mins], "bounds_max": [round(v, 6) for v in maxs],
                           "dimensions": [round(v, 6) for v in dimensions],
                           "horizontal_center": [round(center[0], 6), round(center[2], 6)],
                           "triangles_by_material": primitive_counts,
                           "body_unique_colors": len(set(body_colors))})
            cat = category_key(record.get("category", ""))
            check(cat in LIMITS, f"unknown category {record.get('category')}")
            limit = LIMITS.get(cat, 0)
            budget = record.get("budget", limit)
            check(isinstance(budget, int) and not isinstance(budget, bool) and 0 < budget <= limit,
                  f"manifest budget {budget} invalid or exceeds category limit {limit}")
            if isinstance(budget, (int, float)):
                check(triangles <= min(limit, budget), f"{triangles} triangles exceed budget {min(limit, budget)}")
            check(record.get("triangles") == triangles, f"manifest triangles {record.get('triangles')} != actual {triangles}")
            check(abs(mins[1]) <= args.ground_tolerance, f"ground minY {mins[1]:.6f} outside ±{args.ground_tolerance}")
            check(abs(center[0]) <= args.center_tolerance and abs(center[2]) <= args.center_tolerance,
                  f"X/Z center {center[0]:.6f}, {center[2]:.6f} outside ±{args.center_tolerance}")
            foot = record.get("footprint")
            valid_foot = isinstance(foot, list) and len(foot) == 2 and finite(foot) and all(v > 0 and abs(v-round(v)) < 1e-6 for v in foot)
            check(valid_foot, "manifest footprint must contain two positive integer grid dimensions [X,Z]")
            if valid_foot:
                result["footprint"] = foot
                check(dimensions[0] <= foot[0] + 1e-4 and dimensions[2] <= foot[1] + 1e-4,
                      f"world X/Z dimensions {dimensions[0]:.6f}, {dimensions[2]:.6f} exceed footprint {foot}")
                check(mins[0] >= -foot[0]/2 - args.center_tolerance and maxs[0] <= foot[0]/2 + args.center_tolerance
                      and mins[2] >= -foot[1]/2 - args.center_tolerance and maxs[2] <= foot[1]/2 + args.center_tolerance,
                      "geometry extends outside origin-centered footprint")
            expected_dimensions = record.get("dimensions")
            valid_dimensions = isinstance(expected_dimensions, list) and len(expected_dimensions) == 3 and finite(expected_dimensions)
            check(valid_dimensions, "manifest dimensions must be [X,Y,Z] in glTF meters")
            if valid_dimensions:
                check(all(abs(a-b) <= args.dimension_tolerance for a, b in zip(dimensions, expected_dimensions)),
                      f"manifest dimensions {expected_dimensions} disagree with actual {result['dimensions']}")

        stage("geometry", geometry)

    def source_check():
        source = root / "sources" / f"{name}.blend"
        return blend_header(source)

    result["source"] = stage("source", source_check)
    result["renders"] = {}
    if not args.skip_renders:
        for view in VIEWS:
            result["renders"][view] = stage(f"render {view}", lambda v=view: check_png(root / "renders" / name / f"{v}.png"))
    result["status"] = "pass" if not result["errors"] else "fail"
    return result


def markdown_report(report):
    lines = ["# Hollowmere binary export validation", "", f"Generated: {report['generated_utc']}", "",
             f"**Result: {report['status'].upper()}**. {report['passed']} / {report['asset_count']} assets passed.", "",
             "All measurements below are read from delivered GLB bytes, not copied from Blender statistics.", "",
             "| Asset | Category | Triangles | GLB bytes | Dimensions X/Y/Z (m) | Grid X/Z (m) | Result |",
             "|---|---|---:|---:|---|---|---|"]
    for asset in report["assets"]:
        dims = " / ".join(f"{v:.3f}" for v in asset.get("dimensions", [])) or "—"
        foot = " / ".join(str(v) for v in asset.get("footprint", [])) or "—"
        lines.append(f"| {asset['name']} | {asset.get('category', '—')} | {asset.get('triangles', '—')} | {asset.get('bytes', '—')} | {dims} | {foot} | {asset['status'].upper()} |")
    lines += ["", "## Checks", "", "- GLB v2 header, chunks, embedded buffer, accessor ranges/strides, indices and finite numeric values.",
              "- One merged mesh; one mesh instance; baked identity transforms; glTF Y up; ground pivot and X/Z centering.",
              "- Indexed triangles within 8,000 landmark / 4,000 building / 800 street limits and manifest budgets.",
              "- GLB strictly below 400,000 bytes; dimensions/triangles/bytes agree with manifest; integer grid footprint contains bounds.",
              "- Body uses white base factor and nonblack COLOR_0; optional Glow is emissive; all material and vertex alpha opaque.",
              "- No textures/images, Draco/meshopt compression, lights, cameras, animation, or skinning.",
              "- Signed normalized normals require declared KHR_mesh_quantization; decoded normals are checked for unit length.",
              "- Source .blend presence and header; render PNG presence, dimensions, chunk integrity and CRCs." if not report["renders_skipped"] else "- Source .blend presence and header. Render checks deliberately skipped (--skip-renders).",
              "", "## Scope", "", "This independent validator does not replace the complete Khronos glTF Validator or visual review. It does not prove artistic quality, engine appearance, mesh manifoldness, or that a Blender source opens; source verification here reads the Blender header through uncompressed, gzip or Zstandard storage. glTF Y-up orientation and intended front direction still require visual review."]
    failures = report["errors"] or any(a["errors"] for a in report["assets"])
    if failures:
        lines += ["", "## Failures", ""]
        lines += [f"- Pack: {error}" for error in report["errors"]]
        for asset in report["assets"]:
            lines += [f"- {asset['name']}: {error}" for error in asset["errors"]]
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--skip-renders", action="store_true", help="skip preview PNG checks during partial builds")
    parser.add_argument("--expected-count", type=int, default=27, help="expected manifest count, or 0 to allow partial builds (default: 27)")
    parser.add_argument("--ground-tolerance", type=float, default=0.025)
    parser.add_argument("--center-tolerance", type=float, default=0.12)
    parser.add_argument("--dimension-tolerance", type=float, default=0.02)
    args = parser.parse_args(argv)
    if min(args.ground_tolerance, args.center_tolerance, args.dimension_tolerance) < 0 or args.expected_count < 0:
        parser.error("tolerances and expected count cannot be negative")
    root = args.root.resolve()
    report = {"generated_utc": datetime.now(timezone.utc).isoformat(), "root": str(root), "validator_version": 2,
              "renders_skipped": args.skip_renders, "limits": {"triangles": LIMITS, "glb_bytes_strictly_less_than": SIZE_LIMIT},
              "tolerances_m": {"ground": args.ground_tolerance, "center": args.center_tolerance, "dimensions": args.dimension_tolerance},
              "errors": [], "assets": []}
    try:
        manifest = json.loads((root / "manifest.json").read_text())
        if isinstance(manifest, list):
            records = manifest
        else:
            records = next((manifest[k] for k in ("assets", "records", "models") if k in manifest), None)
        require(isinstance(records, list), "manifest must be a list or contain an assets/records/models list")
        require(all(isinstance(record, dict) for record in records), "every manifest record must be an object")
        if args.expected_count and len(records) != args.expected_count:
            report["errors"].append(f"expected {args.expected_count} assets, manifest has {len(records)}")
        names = [r.get("name") for r in records]
        if len(set(str(name) for name in names)) != len(names):
            report["errors"].append("duplicate asset names in manifest")
        actual = {p.stem for p in (root / "models").glob("*.glb")}
        extra = sorted(actual - set(str(n) for n in names))
        if extra:
            report["errors"].append(f"GLBs absent from manifest: {', '.join(extra)}")
        for record in records:
            result = check_asset(root, record, args)
            report["assets"].append(result)
            print(f"{result['status'].upper():4} {result['name']}: {result.get('triangles', '?')} tris, {result.get('bytes', '?')} bytes")
            for error in result["errors"]:
                print(f"     {error}")
    except (OSError, ValueError, TypeError, KeyError) as exc:
        report["errors"].append(f"manifest: {exc}")
    report["asset_count"] = len(report["assets"])
    report["passed"] = sum(a["status"] == "pass" for a in report["assets"])
    report["status"] = "pass" if report["asset_count"] > 0 and report["passed"] == report["asset_count"] and not report["errors"] else "fail"
    report["totals"] = {"triangles": sum(a.get("triangles", 0) for a in report["assets"]),
                        "glb_bytes": sum(a.get("bytes", 0) for a in report["assets"])}
    destination = root / "reports"
    destination.mkdir(parents=True, exist_ok=True)
    (destination / "glb_validation.json").write_text(json.dumps(report, indent=2) + "\n")
    (destination / "glb_validation.md").write_text(markdown_report(report))
    for error in report["errors"]:
        print(f"FAIL pack: {error}")
    print(f"{report['status'].upper()}: {report['passed']}/{report['asset_count']} assets. Reports: {destination}")
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
