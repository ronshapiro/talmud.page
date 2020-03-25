import api_request_handler
import argparse
import json
import sys

class TestAmud(object):
    def __init__(self, masechet, amud):
        self.masechet = masechet
        self.amud = amud

    def __str__(self):
        return "TestAmud(masechet = %s, amud = %s)" % (self.masechet, self.amud)

    def input_file(self):
        return "test_data/api_request_handler/%s.%s.input.json" % (
            self.masechet, self.amud)

    def output_file(self):
        return "test_data/api_request_handler/%s.%s.expected-output.json" % (
            self.masechet, self.amud)

test_amudim = (
    TestAmud("Berakhot", "2a"),
    TestAmud("Berakhot", "34b"),
    TestAmud("Shabbat", "100a"),
    TestAmud("Niddah", "48b"),
)

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

class FakeRequestMaker(object):
    def request_amud(self, masechet, amud):
        with open(TestAmud(masechet, amud).input_file(), "r") as input_file:
            return FakeResponse(input_file.read())


class FakeResponse(object):
    def __init__(self, text):
        self.text = text
        self.status_code = 200

    def json(self):
        return json.loads(self.text)

request_handler = api_request_handler.ApiRequestHandler(FakeRequestMaker())

def doTest():
    for test_amud in test_amudim:
        # translating to, and then from, json normalizes things like python tuples -> json lists
        actual = json.loads(json.dumps(
            request_handler.amud_api_request(test_amud.masechet, test_amud.amud)))
        expected = json.loads(open(test_amud.output_file(), "r").read())
        if actual != expected:
            raise AssertionError("Not equal for %s %s" % test_amud)

def write_json(file_name, data):
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  ensure_ascii = False,
                  indent = 2,
                  sort_keys = True)

def setup():
    request_maker = api_request_handler.RealRequestMaker()
    for test_amud in test_amudim:
        write_json(test_amud.input_file(),
                   request_maker.request_amud(test_amud.masechet, test_amud.amud).json())
        write_json(test_amud.output_file(),
                   request_handler.amud_api_request(test_amud.masechet, test_amud.amud))

if args.setup:
    setup()
else:
    doTest()
