#!/usr/bin/env python3
"""Create and integrity-check a clean Hollowmere delivery ZIP.

The ZIP omits temporary test renders, QA scratch images, logs, Python caches and
Blender backup files. It retains all assets, final previews, references and tools.
"""
import hashlib
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
target = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else root.parent / 'hollowmere-town-kit.zip'
records = json.loads((root / 'manifest.json').read_text())
validation = json.loads((root / 'reports/glb_validation.json').read_text())
assert validation['status'] == 'pass' and not validation['renders_skipped'], 'Full validation must pass before packaging.'
assert len(records) == validation['asset_count'] == 27

files = [root / 'README.md', root / 'manifest.json']
files += sorted((root / 'models').glob('*.glb'))
files += sorted((root / 'sources').glob('*.blend'))
files += sorted(p for p in (root / 'scripts').iterdir() if p.suffix in ('.py', '.sh', '.cjs'))
files += sorted(p for p in (root / 'reports').iterdir() if p.suffix in ('.json', '.md') and p.name != 'package-checks.json')
files += sorted(p for p in (root / 'references').rglob('*') if p.is_file())
for record in records:
    for mode in ['front', 'three-quarter', 'night']:
        path = root / 'renders' / record['name'] / (mode + '.png')
        with Image.open(path) as image:
            assert image.size == (640, 640), str(path)
            image.verify()
        files.append(path)
square_dimensions = {}
for name in ['mock-town-square-dusk.png', 'town-square-close-dusk.png',
             'architecture-contact-sheet.png', 'street-contact-sheet.png',
             'night-contact-sheet.png', 'reference-comparison.png']:
    path = root / 'renders' / name
    with Image.open(path) as image:
        square_dimensions[name] = list(image.size)
        image.verify()
    files.append(path)
for record in records:
    assert root / 'sources' / (record['name'] + '.blend') in files
assert root / 'sources/mock-town-square.blend' in files
assert len(files) == len(set(files))
assert all(p.is_file() for p in files)

hashes = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
report = {'generated_utc': datetime.now(timezone.utc).isoformat(), 'status': 'pass',
          'asset_count': len(records), 'individual_views': 81, 'source_blends': 28,
          'validation_passed': True, 'square_and_sheet_dimensions': square_dimensions,
          'files_sha256': hashes}
report_path = root / 'reports/package-checks.json'
report_path.write_text(json.dumps(report, indent=2) + '\n')
files.append(report_path)

with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(files):
        archive.write(path, 'hollowmere/' + path.relative_to(root).as_posix())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None, 'ZIP CRC verification failed.'
    assert len(archive.namelist()) == len(files)
    for path in files:
        archived = archive.read('hollowmere/' + path.relative_to(root).as_posix())
        assert hashlib.sha256(archived).digest() == hashlib.sha256(path.read_bytes()).digest()
print(json.dumps({'path': str(target), 'bytes': target.stat().st_size,
                  'file_count': len(files), 'zip_crc_and_hashes': 'pass',
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}, indent=2))
