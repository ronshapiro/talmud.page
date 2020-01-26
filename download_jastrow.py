## https://www.sefaria.org/api/texts/Jastrow%2C_%D7%90?commentary=0&context=1&pad=0&wrapLinks=1&multiple=1000

import json
import urllib.parse
import urllib.request

URL_TEMPLATE = "https://www.sefaria.org/api/texts/%s?commentary=0&context=1&pad=0&wrapLinks=1&multiple=100"

def sefaria_request(label):
    with urllib.request.urlopen(url = URL_TEMPLATE % urllib.parse.quote(label)) as response:
        response_text = response.read().decode("utf-8")
        return json.loads(response_text)

index = {}
next_label = "Jastrow,_א"
count = 0
while next_label != None and count is not 10:
    count += 1
    for item in sefaria_request(next_label):
        if len(item["heTitleVariants"]) != 1:
            print(item["heTitleVariants"])
        for term in item["heTitleVariants"]:
            if term in index:
                print("%s already present" %term)
            index[term] = item["text"]
        next_label = item.get("next", None)
    
with open("sefaria-data/Jastrow.json", "w") as output:
    json.dump(index, output)

#first = sefaria_request("Jastrow,_א")
#print(first)
#print(first["next"])
#print(sefaria_request(first["next"]))
#print(sefaria_request(first["next"])["next"])
