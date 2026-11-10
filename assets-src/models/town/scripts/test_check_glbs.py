"""Regression tests for the independent validator; uses synthetic temporary files only."""
import copy
import gzip
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest
from types import SimpleNamespace

SPEC = importlib.util.spec_from_file_location("check_glbs", Path(__file__).with_name("check_glbs.py"))
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


def fixture():
    binary = struct.pack("<9f", -.5, 0, 0, .5, 0, 0, 0, 1, 0)
    binary += struct.pack("<9f", 0, 0, 1, 0, 0, 1, 0, 0, 1)
    binary += bytes([128, 80, 40, 255]) * 3
    binary += struct.pack("<3H", 0, 1, 2)
    doc = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": [0]}],
           "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2}, "indices": 3, "material": 0}]}],
           "materials": [{"name": "Body", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1]}}],
           "buffers": [{"byteLength": len(binary)}],
           "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36}, {"buffer": 0, "byteOffset": 36, "byteLength": 36},
                           {"buffer": 0, "byteOffset": 72, "byteLength": 12}, {"buffer": 0, "byteOffset": 84, "byteLength": 6}],
           "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [-.5, 0, 0], "max": [.5, 1, 0]},
                         {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
                         {"bufferView": 2, "componentType": 5121, "count": 3, "type": "VEC4", "normalized": True},
                         {"bufferView": 3, "componentType": 5123, "count": 3, "type": "SCALAR"}]}
    return doc, binary


def encode(doc, binary):
    encoded = json.dumps(doc, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    return struct.pack("<4sII", b"glTF", 2, 28 + len(encoded) + len(binary)) + struct.pack("<II", len(encoded), 0x4e4f534a) + encoded + struct.pack("<II", len(binary), 0x004e4942) + binary


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="hollowmere-validator-test-")
        self.root = Path(self.temp.name)
        (self.root / "models").mkdir()
        (self.root / "sources").mkdir()
        (self.root / "sources" / "sample.blend").write_bytes(b"BLENDER-v403")
        self.doc, self.binary = fixture()
        self.options = SimpleNamespace(skip_renders=True, ground_tolerance=.025, center_tolerance=.12, dimension_tolerance=.02)

    def tearDown(self):
        self.temp.cleanup()

    def validate(self, mutate=None, binary=None, record_changes=None):
        if mutate:
            mutate(self.doc)
        raw = encode(self.doc, self.binary if binary is None else binary)
        (self.root / "models" / "sample.glb").write_bytes(raw)
        record = {"name": "sample", "category": "street", "budget": 800, "triangles": 1,
                  "bytes": len(raw), "dimensions": [1, 1, 0], "footprint": [1, 1]}
        record.update(record_changes or {})
        return checker.check_asset(self.root, record, self.options)

    def assert_failure(self, result, needle):
        self.assertEqual(result["status"], "fail", result)
        self.assertIn(needle, " ".join(result["errors"]))

    def test_valid(self):
        result = self.validate()
        self.assertEqual(result["status"], "pass", result)
        self.assertEqual(result["triangles"], 1)
        self.assertEqual(result["bytes"], (self.root / "models" / "sample.glb").stat().st_size)

    def quantized_normals(self):
        self.binary = self.binary[:36] + bytes([0, 0, 127, 0]) * 3 + self.binary[72:]
        self.doc['buffers'][0]['byteLength'] = len(self.binary)
        self.doc['bufferViews'][1].update(byteLength=12, byteStride=4)
        self.doc['bufferViews'][2]['byteOffset'] = 48
        self.doc['bufferViews'][3]['byteOffset'] = 60
        self.doc['accessors'][1].update(componentType=5120, normalized=True)
        self.doc['extensionsUsed'] = ['KHR_mesh_quantization']
        self.doc['extensionsRequired'] = ['KHR_mesh_quantization']

    def test_quantized_normals(self):
        self.quantized_normals()
        self.assertEqual(self.validate()['status'], 'pass')

    def test_quantized_normals_missing_extension(self):
        self.quantized_normals()
        self.assert_failure(self.validate(lambda d: d.pop('extensionsRequired')), 'requires KHR_mesh_quantization')

    def test_quantized_normals_not_normalized(self):
        self.quantized_normals()
        self.assert_failure(self.validate(lambda d: d['accessors'][1].update(normalized=False)), 'must be normalized')

    def test_quantized_normals_nonunit(self):
        self.quantized_normals()
        self.binary = self.binary[:36] + bytes([0, 0, 12, 0]) * 3 + self.binary[48:]
        self.assert_failure(self.validate(), 'non-unit or zero normals')

    def test_gzip_blend_source(self):
        (self.root / 'sources' / 'sample.blend').write_bytes(gzip.compress(b'BLENDER-v403' + bytes(40)))
        result = self.validate()
        self.assertEqual(result['status'], 'pass', result)
        self.assertEqual(result['source']['compression'], 'gzip')

    def test_zstandard_blend_source(self):
        try:
            import zstandard
        except ImportError:
            self.skipTest('zstandard package is unavailable')
        (self.root / 'sources' / 'sample.blend').write_bytes(zstandard.ZstdCompressor().compress(b'BLENDER-v403' + bytes(40)))
        result = self.validate()
        self.assertEqual(result['status'], 'pass', result)
        self.assertEqual(result['source']['compression'], 'zstandard')

    def test_invalid_compressed_source_header(self):
        (self.root / 'sources' / 'sample.blend').write_bytes(gzip.compress(b'NOT A BLENDER FILE'))
        self.assert_failure(self.validate(), 'unrecognized .blend header')

    def test_truncated_gzip_source(self):
        (self.root / 'sources' / 'sample.blend').write_bytes(b'\x1f\x8b\x08\x00')
        self.assert_failure(self.validate(), 'source:')

    def test_truncated_view(self):
        self.assert_failure(self.validate(lambda d: d["bufferViews"][0].update(byteLength=24)), "exceed bufferView")

    def test_outside_buffer(self):
        self.assert_failure(self.validate(lambda d: d["bufferViews"][0].update(byteLength=9999)), "outside embedded buffer")

    def test_nonfinite_positions(self):
        self.assert_failure(self.validate(binary=struct.pack("<f", float("nan")) + self.binary[4:]), "non-finite")

    def test_invalid_indices(self):
        self.assert_failure(self.validate(binary=self.binary[:-2] + struct.pack("<H", 20)), "index out of range")

    def test_black_colors(self):
        self.assert_failure(self.validate(binary=self.binary[:72] + bytes([0, 0, 0, 255]) * 3 + self.binary[84:]), "black Body")

    def test_missing_colors(self):
        self.assert_failure(self.validate(lambda d: d["meshes"][0]["primitives"][0]["attributes"].pop("COLOR_0")), "requires COLOR_0")

    def test_alpha(self):
        self.assert_failure(self.validate(lambda d: d["materials"][0].update(alphaMode="BLEND")), "not OPAQUE")

    def test_base_factor(self):
        self.assert_failure(self.validate(lambda d: d["materials"][0]["pbrMetallicRoughness"].update(baseColorFactor=[.8, .8, .8, 1])), "must be white")

    def test_draco(self):
        self.assert_failure(self.validate(lambda d: d.update(extensionsUsed=["KHR_draco_mesh_compression"])), "Draco")

    def test_external_buffer(self):
        self.assert_failure(self.validate(lambda d: d["buffers"][0].update(uri="test.bin")), "no buffer URI")

    def test_world_transforms(self):
        result = self.validate(lambda d: d["nodes"][0].update(translation=[1, 2, 0]))
        self.assert_failure(result, "not baked/identity")
        self.assertEqual(result["bounds_min"], [.5, 2., 0.])
        self.assertIn("ground", " ".join(result["errors"]))

    def test_parent_transform(self):
        def mutate(d):
            d["nodes"].append({"children": [0], "translation": [1, 0, 0]})
            d["scenes"][0]["nodes"] = [1]
        self.assert_failure(self.validate(mutate), "world transform")

    def test_manifest_counts(self):
        self.assert_failure(self.validate(record_changes={"triangles": 2}), "manifest triangles")

    def test_manifest_dimensions(self):
        self.assert_failure(self.validate(record_changes={"dimensions": [9, 9, 9]}), "manifest dimensions")

    def test_footprint_integer(self):
        self.assert_failure(self.validate(record_changes={"footprint": [.5, 1]}), "integer grid dimensions")

    def test_budget(self):
        self.assert_failure(self.validate(record_changes={"budget": 900}), "exceeds category limit")

    def test_missing_source(self):
        (self.root / "sources" / "sample.blend").unlink()
        self.assert_failure(self.validate(), "source:")

    def test_missing_previews(self):
        self.options.skip_renders = False
        self.assert_failure(self.validate(), "render front:")

    def test_cli_reports(self):
        result = self.validate()
        record = {"name": "sample", "category": "street", "budget": 800, "triangles": 1,
                  "bytes": result["bytes"], "dimensions": [1, 1, 0], "footprint": [1, 1]}
        (self.root / "manifest.json").write_text(json.dumps([record]))
        self.assertEqual(checker.main([str(self.root), "--skip-renders", "--expected-count", "0"]), 0)
        report = json.loads((self.root / "reports" / "glb_validation.json").read_text())
        self.assertEqual(report["status"], "pass")
        self.assertTrue((self.root / "reports" / "glb_validation.md").exists())


if __name__ == "__main__":
    unittest.main()
