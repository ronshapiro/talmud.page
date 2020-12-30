from util.json_files import write_json
import api_request_handler
import argparse
import json

def input_file_path(ref):
    return f"test_data/api_request_handler/{ref.replace(' ', '_')}.input.json"

class TestSection(object):
    def __init__(self, masechet, section):
        self.masechet = masechet
        self.section = section

    def __str__(self):
        return "TestSection(masechet = %s, section = %s)" % (self.masechet, self.section)

    def output_file_path(self):
        return "test_data/api_request_handler/%s.%s.expected-output.json" % (
            self.masechet.replace(" ", "_"), self.section)

test_sections = (
    TestSection("Berakhot", "2a"),
    TestSection("Berakhot", "34b"),
    TestSection("Shabbat", "100a"),
    TestSection("Eruvin", "11a"), # Has images
    TestSection("Eruvin", "6b"), # Has images, including a comment with multiple images
    TestSection("Eruvin", "105a"), # Ends with Hadran that has vocalization
    TestSection("Nazir", "33b"), # Has no gemara, just Tosafot
    TestSection("Shabbat", "74b"), # Has weird API response with nested comment text from Rosh
    TestSection("Tamid", "25b"), # No Rashi

    TestSection("Genesis", "43"),
    TestSection("Deuteronomy", "34"),
    TestSection("I Samuel", "18"),
    TestSection("Obadiah", "1"),
)

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

class FakeRequestMaker(object):
    async def make_request(self, ref, *args, **kwargs):
        with open(input_file_path(ref), "r") as input_file:
            return FakeResponse(input_file.read())


class FakeResponse(object):
    def __init__(self, text):
        self.text = text
        self.status_code = 200

    def json(self):
        return json.loads(self.text)

def doTest():
    request_handler = api_request_handler.CompoundRequestHandler(FakeRequestMaker())
    for test_section in test_sections:
        # translating to, and then from, json normalizes things like python tuples -> json lists
        actual = json.loads(json.dumps(
            request_handler.handle_request(test_section.masechet, test_section.section)))
        expected = json.loads(open(test_section.output_file_path(), "r").read())
        if actual != expected:
            raise AssertionError("Not equal for %s" % test_section)

class RecordingRequestMaker(object):
    def __init__(self):
        self._real_request_maker = api_request_handler.RealRequestMaker()

    async def make_request(self, ref, *args, **kwargs):
        results = await self._real_request_maker.make_request(ref, *args, **kwargs)
        write_json(input_file_path(ref), results.json())
        return results

def setup():
    request_handler = api_request_handler.CompoundRequestHandler(RecordingRequestMaker())
    for test_section in test_sections:
        write_json(test_section.output_file_path(),
                   request_handler.handle_request(test_section.masechet, test_section.section))

if args.setup:
    setup()
else:
    doTest()
