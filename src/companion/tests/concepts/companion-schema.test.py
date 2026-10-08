"""Independent Draft 2020-12 validation, separate from the authoritative runtime contract."""
import json
import os
from pathlib import Path
import subprocess
import jsonschema

ROOT = Path(__file__).resolve().parents[4]
COMMAND = [os.environ.get('NODE', 'node'), '--experimental-strip-types', '--input-type=module', '-e',
           "import {schemaCorpus} from '#shared/testing/companion-schema-fixture.mjs'; "
           "process.stdout.write(JSON.stringify(schemaCorpus()));"]


def main():
    result = subprocess.run(COMMAND, cwd=ROOT, capture_output=True, text=True, check=True, timeout=45)
    corpus = json.loads(result.stdout)
    jsonschema.Draft202012Validator.check_schema(corpus['schema'])
    validator = jsonschema.Draft202012Validator(corpus['schema'], format_checker=jsonschema.FormatChecker())
    count = 0
    for case in corpus['positive']:
        validator.validate(case['document'])
        count += 1
    for case in corpus['negative']:
        schema_rejects = not validator.is_valid(case['document'])
        if schema_rejects != case['schemaRejects']:
            raise AssertionError('Unexpected structural validation outcome: ' + case['name'])
        count += 1
    print(json.dumps({'status': 'passed', 'cases': count, 'schema': corpus['schema']['$id'],
                      'scope': 'Independent structural schema plus explicit semantic-only negative controls; not browser/native acceptance'}))


if __name__ == '__main__':
    main()
