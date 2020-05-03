import api_request_handler
import argparse
import json
import sys

def input_file_path(ref):
    return f"test_data/api_request_handler/{ref}.input.json"

class TestAmud(object):
    def __init__(self, masechet, amud):
        self.masechet = masechet
        self.amud = amud

    def __str__(self):
        return "TestAmud(masechet = %s, amud = %s)" % (self.masechet, self.amud)

    def output_file_path(self):
        return "test_data/api_request_handler/%s.%s.expected-output.json" % (
            self.masechet, self.amud)

test_amudim = (
    TestAmud("Berakhot", "2a"),
    TestAmud("Berakhot", "34b"),
    TestAmud("Shabbat", "100a"),
    TestAmud("Niddah", "48b"),
    TestAmud("Nazir", "33b"), # Has no gemara, just Tosafot
    # TODO: make sure that the client side handles this correctly
    TestAmud("Shabbat", "74b"), # Has weird API response with nested comment text from Rosh
    TestAmud("Tamid", "25b"), # No Rashi
)

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

class FakeRequestMaker(object):
    async def request_amud(self, ref):
        with open(input_file_path(ref), "r") as input_file:
            return FakeResponse(input_file.read())


class FakeResponse(object):
    def __init__(self, text):
        self.text = text
        self.status_code = 200

    def json(self):
        return json.loads(self.text)

def doTest():
    request_handler = api_request_handler.ApiRequestHandler(FakeRequestMaker())
    for test_amud in test_amudim:
        # translating to, and then from, json normalizes things like python tuples -> json lists
        actual = json.loads(json.dumps(
            request_handler.amud_api_request(test_amud.masechet, test_amud.amud)))
        expected = json.loads(open(test_amud.output_file_path(), "r").read())
        if actual != expected:
            raise AssertionError("Not equal for %s" % test_amud)

def write_json(file_name, data):
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  ensure_ascii = False,
                  indent = 2,
                  sort_keys = True)
        output_file.write("\n")

class RecordingRequestMaker(object):
    def __init__(self):
        self._real_request_maker = api_request_handler.RealRequestMaker()

    async def request_amud(self, ref):
        results = await self._real_request_maker.request_amud(ref)
        write_json(input_file_path(ref), results.json())
        return results

def setup():
    request_handler = api_request_handler.ApiRequestHandler(RecordingRequestMaker())
    for test_amud in test_amudim:
        write_json(test_amud.output_file_path(),
                   request_handler.amud_api_request(test_amud.masechet, test_amud.amud))

if args.setup:
    setup()
else:
    doTest()
