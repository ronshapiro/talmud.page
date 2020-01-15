var renderResults = function(amud) {
  var output = [];
  for (var i in amud) {
    var hebrew = [];
    var section = amud[i];
    hebrew.push(`<div class="gemara">${section.gemara}</div>`);
    if (section.rashi.length) {
      hebrew.push('<div class="rashi">');
      hebrew.push('<div class="commentary_header">רש״י</div>');
      for (var r in section.rashi) {
        hebrew.push(`<div>${section.rashi[r]}</div>`);
      }
      hebrew.push('</div>');
    }
    if (section.tosafot.length) {
      hebrew.push('<div class="tosafot">');
      hebrew.push('<div class="commentary_header">תוספות</div>');
      for (var r in section.tosafot) {
        hebrew.push(`<div>${section.tosafot[r]}</div>`);
      }
      hebrew.push('</div>');
    }
    output.push("<tr>");
    output.push(`<td dir="rtl" class="hebrew">${hebrew.join("")}</td>`);
    output.push(`<td dir="ltr" class="english"><div>${section.english}</div></td>`);
    output.push("</tr><tr><td><br></td></tr>");
  }
  $("#results").html(output.join(""));
};

$.ajax({url: location.href + "/json", type: "GET", success: renderResults});
