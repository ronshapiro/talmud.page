// TODO: rewrite all loops to use .forEach
jQuery.fn.extend({
  betterDoubleClick: function(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      this.click(function(event) {
        var lastTime = this.lastTime || 0;
        var now = new Date().getTime();
        if (now - lastTime <= 1000) {
          fn(event);
          this.lastTime = 0;
        } else {
          this.lastTime = now;
        }
      });
    } else {
      this.dblclick(fn);
    }
    return this;
  }
});

var debugResultsData = {}

var onceDocumentReady = {
  ready: false,
  queue: [],
  execute: function(fn) {
    if (this.ready) {
      fn();
      return;
    }
    this.queue.push(fn);
  },
  declareReady: function() {
    if (this.ready) {
      throw "Already ready!";
    }
    this.ready = true;
    this.queue.forEach(fn => fn());
  },
}

var _concat = function(list1, list2) {
  var result = [];
  if (list1) result.push(...list1);
  if (list2) result.push(...list2);
  return result;
}

var setVisibility = function(element, toShow) {
  if (toShow) {
    element.show();
  } else {
    element.hide();
  }
}

class Renderer {
  constructor(commentaryTypes, translationOption) {
    this._commentaryTypes = commentaryTypes;
    this._translationOption = translationOption;
  }

  _makeCell(text, dir, classes) {
    classes = classes || [];
    classes.push("table-cell");
    var classAttribute = classes ? `class="${classes.join(" ")}"` : "";
    return `<div dir="${dir}" ${classAttribute}>${text}</div>`;
  }

  _hebrewCell(text, classes) {
    return this._makeCell(text, "rtl", _concat(["hebrew"], classes));
  }

  _englishCell(text, classes) {
    return this._makeCell(
      `<div class="english-div line-clampable" style="-webkit-line-clamp: 1;">`
        + text
        + `</div>`,
      "ltr",
      _concat(["english"], classes));
  }

  _tableRow(hebrew, english, options) {
    options = options || {};
    var classes = _concat(["table-row"], options.classes);

    var output = [`<div class="${classes.join(" ")}">`];

    var cellClasses = [];

    if ((this._isEmptyText(hebrew) || this._isEmptyText(english)) &&
        !options.overrideFullRow) {
      cellClasses.push("fullRow");
    }

    if (!this._isEmptyText(hebrew)) {
      output.push(this._hebrewCell(hebrew, cellClasses));
    }

    if (!this._isEmptyText(english)) {
      output.push(this._englishCell(english, cellClasses));
    }

    output.push("</div>");
    return output.join("");
  };

  _isEmptyText(stringOrList) {
    return !stringOrList || stringOrList === "" || stringOrList.length == 0;
  }

  _stringOrListToString(stringOrList) {
    return typeof stringOrList === "string"
      ? stringOrList
      : stringOrList.join("<br>");
  }

  _commentRow(commentId, comment, commentaryKind) {
    var output = [];

    var commentRowOptions = {
      classes: [commentId, "commentaryRow", commentaryKind.className],
    };

    if (commentaryKind.showTitle) {
      output.push(
        this._tableRow(
          `<strong>${comment.sourceHeRef}</strong>`,
          this._isEmptyText(comment.en) ? "" : `<strong>${comment.sourceRef}</strong>`,
          commentRowOptions));
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length) {
      for (var i = 0; i < comment.he.length; i++) {
        output.push(this._tableRow(comment.he[i], comment.en[i], commentRowOptions));
      }
    } else {
      output.push(
        this._tableRow(
          this._stringOrListToString(comment.he),
          this._stringOrListToString(comment.en),
          commentRowOptions));
    }

    return output.join("");
  }

  _commentaryRowOutput(sectionLabel, commentaries) {
    var output = []

    var tableRowOptions =
        this._translationOption !== "english-side-by-side" ? {} : {overrideFullRow: true};
    var showButtons = [];
    for (var i in this._commentaryTypes) {
      var commentaryKind = this._commentaryTypes[i];
      var commentary = commentaries[commentaryKind.englishName];

      if (commentary) {
        var classes = [
          "commentary_header",
          commentaryKind.className,
          commentaryKind.cssCategory
        ].join(" ");
        var commentId = `${sectionLabel}-${commentaryKind.className}`;
        var extraAttrs = [
          `tabindex="0"`,
          `data-commentary="${commentaryKind.englishName}"`,
          `data-section-label="${sectionLabel}"`,
          `data-comment-id="${commentId}"`,
        ].join(" ");
        showButtons.push(
          `<a class="${classes} show-button" ${extraAttrs}>${commentaryKind.hebrewName}</a>`);
        output.push(
          this._tableRow(
            `<a class="${classes} hide-button" ${extraAttrs}>${commentaryKind.hebrewName}</a>`,
            "",
            tableRowOptions));

        commentary.forEach(
          comment => output.push(this._commentRow(commentId, comment, commentaryKind)));
      }
    }
    output.push(this._tableRow(showButtons.join(""), "", tableRowOptions));
    return output.join("");
  }

  _clickIfEnter(alternateButton) {
    return function(event) {
      if (!event || event.originalEvent.code !== "Enter") return;
      event.target.click();
      alternateButton.focus();
    }
  }

  _setCommentaryButtons($container) {
    var showButtons = $container.find(".show-button");
    for (var i = 0; i < showButtons.length; i++) {
      var showButton = $(showButtons[i]);
      var label = showButton.data("comment-id")
      var hideButton = $container.find(`.hide-button[data-comment-id=${label}]`);
      var commentaryRows = $container.find(`.commentaryRow.${label}`);

      // these functions need to capture the loop variables
      var setShownState = function(showButton, hideButton, commentaryRows) {
        return function(show) {
          setVisibility(showButton, !show);
          setVisibility(hideButton.parents(".table-row"), show);
          setVisibility(commentaryRows, show);
        }
      }(showButton, hideButton, commentaryRows);

      setShownState(false);

      var setMaxLines = this._setMaxLines;
      var clickListener = function(setShownState, commentaryRows, label) {
        var show = false;
        var maxLinesEvaluated = false;
        return function(event) {
          show = !show;
          setShownState(show);

          if (show && !maxLinesEvaluated) {
            maxLinesEvaluated = true;
            for (var j = 0; j < commentaryRows.length; j++) {
              setMaxLines($(commentaryRows[j]));
            }
          }
          var element = $(event.toElement);
          gtag("event", show ? "commentary_viewed" : "commentary_hidden", {
            // these two || alternatives are kinda hacks, but they do the job for now
            commentary: element.data("commentary") || "<translation>",
            section: element.data("section-label") || label.replace("-translation", ""),
          });
        }
      }(setShownState, commentaryRows, label);

      showButton.click(clickListener);
      hideButton.click(clickListener);
      showButton.on('keypress', this._clickIfEnter(hideButton));
      hideButton.on('keypress', this._clickIfEnter(showButton));

      if (showButton.hasClass("translation")) {
        showButton.closest(".section-container").find(".gemara").betterDoubleClick(clickListener);
        if (localStorage.showTranslationButton !== "yes") {
          showButton.remove();
          hideButton.remove();
        }
      }
    }
  };

  _setEnglishClickListeners($container) {
    var sections = $container.find(".english-div");
    for (var i = 0; i < sections.length; i++) {
      var section = $(sections[i]);
      section.betterDoubleClick(this._englishClickListener(section));
    }
  };

  _englishClickListener(element) {
    return function() {
      element.toggleClass("line-clampable");
    };
  }

  _createContainerHtml(containerData) {
    var output = [`<h2>${containerData.title}</h2>`];
    for (var i = 0; i < containerData.sections.length; i++) {
      var section = containerData.sections[i];
      var sectionLabel = `${containerData.id}_section_${i+1}`;
      output.push(`<div id="${sectionLabel}" class="section-container">`);

      output.push(
         this._tableRow(
          `<div class="gemara" id="${sectionLabel}-gemara">${section.he}</div>`,
          this._translationOption === "english-side-by-side" ? section.en : undefined));

      var commentaries = section.commentary;

      if (commentaries) {
        if (this._translationOption === "both") {
          commentaries.Translation = commentaries.Steinsaltz;
          if (commentaries.Translation) {
            // e.g. Hadran sections have no steinsaltz
            commentaries.Translation[0].en = section.en;
          }
          delete commentaries.Steinsaltz;
        }
        output.push(this._commentaryRowOutput(sectionLabel, commentaries));
      }
      output.push("</div>");
    }
    return output.join("");
  }

  // containerData is an awkward name, but "section" was already taken. Perhaps that can be changed
  // and then we can switch this over?
  renderContainer(containerData, divId) {
    debugResultsData[containerData.id] = containerData;

    var $container = $(`#${divId}`);
    $container.html(this._createContainerHtml(containerData));
    this._setCommentaryButtons($container);
    this._setEnglishClickListeners($container);

    var setMaxLines = this._setMaxLines;
    onceDocumentReady.execute(function() {
      var englishTexts = $container.find(".english-div");
      // this works because the view has 1 character, so the height should be == 1 line.
      var rows = $container.find(".table-row");
      for (var j = 0; j < rows.length; j++) {
        var row = $(rows[j])[0];
        var hebrewHeight = $(row).find(".hebrew").height();
        setMaxLines($(row));
      }

      // Make sure mdl always registers new views correctly
      componentHandler.upgradeAllRegistered();
    });
  };

  _setMaxLines(row) {
    var hebrew = $(row.children()[0])
    var english = $(row.find(".english-div")[0])
    var maxLines = Math.floor(hebrew.height() / english.height());
    english.css("-webkit-line-clamp", maxLines.toString());
  }
}

class TalmudRenderer extends Renderer {
  constructor(translationOption) {
    super(TalmudRenderer._defaultCommentaryTypes(), translationOption);
  }

  static _defaultCommentaryTypes() {
    var commentaryTypes = [
      {
        englishName: "Translation",
        hebrewName: "Translation",
        className: "translation",
      },
      {
        englishName: "Verses",
        hebrewName: 'תנ״ך',
        className: "psukim",
        showTitle: true,
      },
      {
        englishName: "Mishnah",
        hebrewName: "משנה",
        className: "mishna",
        showTitle: true,
      },
      {
        englishName: "Tosefta",
        hebrewName: "תוספתא",
        className: "tosefta",
        showTitle: true,
      },
      {
        englishName: "Rashi",
        hebrewName: 'רש"י',
        className: "rashi",
      },
      {
        englishName: "Tosafot",
        hebrewName: "תוספות",
        className: "tosafot"
      },
      {
        englishName: "Ramban",
        hebrewName: 'רמב״ן',
        className: "ramban"
      },
      {
        englishName: "Rashba",
        hebrewName: 'רשב״א',
        className: "rashba"
      },
      {
        englishName: "Maharsha",
        hebrewName: 'מהרש"א',
        className: "maharsha",
      },
      {
        englishName: "Maharshal",
        hebrewName: 'מהרש"ל',
        className: "maharshal",
      },
      {
        englishName: "Rosh",
        hebrewName: 'רא"ש',
        className: "rosh",
      },
      {
        englishName: "Ritva",
        hebrewName: 'ריטב"א',
        className: "ritva",
      },
      {
        englishName: "Rav Nissim Gaon",
        hebrewName: "רבנו נסים",
        className: "rav-nissim-gaon",
      },
      {
        englishName: "Shulchan Arukh",
        hebrewName: "שולחן ערוך",
        className: "shulchan-arukh",
        cssCategory: "ein-mishpat",
        showTitle: true,
      },
      {
        englishName: "Mishneh Torah",
        hebrewName: "משנה תורה",
        className: "mishneh-torah",
        cssCategory: "ein-mishpat",
        showTitle: true,
      },
      {
        englishName: "Mesorat Hashas",
        type: "mesorat hashas",
        hebrewName: 'מסורת הש״ס',
        className: "mesorat-hashas",
        showTitle: true,
      },
      {
        englishName: "Jastrow",
        hebrewName: "Jastrow",
        className: "jastrow",
      },
    ];

    var steinsaltz = {
      englishName: "Steinsaltz",
      hebrewName: "שטיינזלץ",
      className: "translation",
    };

    if (localStorage.showTranslationButton === "yes") {
      commentaryTypes.push(steinsaltz);
    } else {
      commentaryTypes.unshift(steinsaltz);
    }

    return commentaryTypes;
  }
}
