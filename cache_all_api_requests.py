import api_request_handler
import json
import os
import traceback

def write_json(file_name, data):
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  ensure_ascii = False,
                  sort_keys = True)
        output_file.write("\n")

LAST_AMUD_PER_MASECHET = {
  "Arakhin": "34a",
  "Avodah Zarah": "76b",
  "Bava Batra": "176b",
  "Bava Kamma": "119b",
  "Bava Metzia": "119a",
  "Beitzah": "40b",
  "Bekhorot": "61a",
  "Berakhot": "64a",
  "Chagigah": "27a",
  "Chullin": "142a",
  "Eruvin": "105a",
  "Gittin": "90b",
  "Horayot": "14a",
  "Keritot": "28b",
  "Ketubot": "112b",
  "Kiddushin": "82b",
  "Makkot": "24b",
  "Megillah": "32a",
  "Meilah": "22a",
  "Menachot": "110a",
  "Moed Katan": "29a",
  "Nazir": "66b",
  "Nedarim": "91b",
  "Niddah": "73a",
  "Pesachim": "121b",
  "Rosh Hashanah": "35a",
  "Sanhedrin": "113b",
  "Shabbat": "157b",
  "Shevuot": "49b",
  "Sotah": "49b",
  "Sukkah": "56b",
  "Taanit": "31a",
  "Tamid": "33b",
  "Temurah": "34a",
  "Yevamot": "122b",
  "Yoma": "88a",
  "Zevachim": "120b",
}

def next_amud(amud):
    if amud[-1:] == "a":
        return "%sb" % amud[:-1]
    return "%sa" % (int(amud[:-1]) + 1)

request_handler = api_request_handler.ApiRequestHandler(
    api_request_handler.RealRequestMaker(),
    print_function = lambda *args: None)
for masechet, last_amud in LAST_AMUD_PER_MASECHET.items():
    amud = "2a"
    while True:
        file_path = f"cached_outputs/api_request_handler/{masechet}.{amud}.json"
        if not os.path.exists(file_path):
            try:
                write_json(file_path,
                           request_handler.amud_api_request(masechet, amud))
            except api_request_handler.ApiException as e:
                print(f"ApiException in {masechet} {amud}: %s" %(e.message))
                if e.internal_code == 1:
                    continue
            except Exception as e:
                print(f"Exception in {masechet} {amud}")
                traceback.print_exc()
                continue
        if amud == last_amud:
            break
        amud = next_amud(amud)
    print(f"Finished {masechet}")
print("Finished!")
