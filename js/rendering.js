"use strict";

jQuery.fn.extend({
  betterDoubleClick: function(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      this.click(function(event) {
        var lastTime = this.lastTime || 0;
        const now = new Date().getTime();
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

const debugResultsData = {}

const onceDocumentReady = {
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

const _concat = function() {
  const result = [];
  for (const arg of arguments) {
    if (arg) result.push(...arg);
  }
  return result;
}

const setVisibility = function(element, toShow) {
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
    const classAttribute = classes ? `class="${classes.join(" ")}"` : "";
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
    const classes = _concat(["table-row"], options.classes);

    const attrs = (options.attrs || []).map(attr => `${attr[0]}="${attr[1]}"`).join(" ");
    const output = [`<div class="${classes.join(" ")}" ${attrs}>`];

    const cellClasses = [];

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
    const output = [];

    const commentRowOptions = {
      classes: [commentId, "commentaryRow", commentaryKind.className],
      attrs: [
        ["sefaria-ref", comment.ref],
        ["commentary-kind", commentaryKind.englishName],
      ],
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
    } else if (this._isSefariaReturningLongListsOfSingleCharacters(comment)) {
      output.push(this._tableRow(comment.he.join(""), comment.en.join(""), commentRowOptions));
    } else {
      output.push(
        this._tableRow(
          this._stringOrListToString(comment.he),
          this._stringOrListToString(comment.en),
          commentRowOptions));
    }

    return output.join("");
  }

  // https://github.com/Sefaria/Sefaria-Project/issues/541
  _isSefariaReturningLongListsOfSingleCharacters(comment) {
    if (!Array.isArray(comment.he) || !Array.isArray(comment.en)) {
      return false;
    }
    const reducer = (numberOfSingleCharacters, x) =>
          numberOfSingleCharacters + ((x.length === 1) ? 1 : 0);
    // 3 is a guess of a reasonable minimum for detecting that this is a bug
    return comment.he.reduce(reducer, 0) > 3 && comment.en.reduce(reducer, 0) > 3;
  }

  _forEachCommentary(commentaries, action) {
    for (const commentaryKind of this._commentaryTypes) {
      const commentary = commentaries[commentaryKind.englishName];
      if (commentary) {
        action(commentary, commentaryKind);
      }
    }
  }

  _commentaryRowOutput(sectionLabel, commentaries) {
    if (!commentaries || commentaries.length === 0) {
      return "";
    }

    const commentId = commentaryKind => `${sectionLabel}-${commentaryKind.className}`;
    const makeButton = (commentaryKind, clazz) => {
      const classes = [
        "commentary_header",
        commentaryKind.className,
        commentaryKind.cssCategory,
        clazz,
      ].join(" ");
      const extraAttrs = [
        `tabindex="0"`,
        `data-commentary="${commentaryKind.englishName}"`,
        `data-section-label="${sectionLabel}"`,
        `data-comment-id="${commentId(commentaryKind)}"`,
      ].join(" ");
      return `<a class="${classes}" ${extraAttrs}>${commentaryKind.hebrewName}</a>`;
    };

    const output = []
    const tableRowOptions =
        this._translationOption !== "english-side-by-side" ? {} : {overrideFullRow: true};

    this._forEachCommentary(commentaries, (commentary, commentaryKind) => {
      output.push(this._tableRow(makeButton(commentaryKind, "hide-button"), "", tableRowOptions));

      output.push(`<div class="single-commentator-container ${commentaryKind.className}">`);
      commentary.comments.forEach(comment => {
        output.push(this._commentRow(commentId(commentaryKind), comment, commentaryKind));
      });

      // Add nested commentaries, if any exist
      output.push(this._commentaryRowOutput(commentId(commentaryKind), commentary.commentary));

      output.push(`</div>`);
    });

    const showButtons = [];
    this._forEachCommentary(commentaries, (commentary, commentaryKind) => {
      showButtons.push(makeButton(commentaryKind, "show-button"));
    });
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
    const showButtons = $container.find(".show-button");
    for (var i = 0; i < showButtons.length; i++) {
      const showButton = $(showButtons[i]);
      const label = showButton.data("comment-id")
      const hideButton = $container.find(`.hide-button[data-comment-id=${label}]`);
      const commentaryRows = $container.find(`.commentaryRow.${label}`);
      const commentaryContainer = commentaryRows.parent(".single-commentator-container");

      // these functions need to capture the loop variables
      const setShownState = function(showButton, hideButton, commentaryContainer) {
        return function(show) {
          setVisibility(showButton, !show);
          setVisibility(hideButton.parents(".table-row"), show);
          setVisibility(commentaryContainer, show);
        }
      }(showButton, hideButton, commentaryContainer);

      setShownState(false);

      var clickListener = (setShownState, commentaryRows, label) => {
        var show = false;
        var maxLinesEvaluated = false;
        return (event) => {
          show = !show;
          setShownState(show);

          if (show && !maxLinesEvaluated) {
            maxLinesEvaluated = true;
            for (const row of commentaryRows) {
              this._setMaxLines($(row));
            }
          }
          const element = $(event.toElement);
          gtag("event", show ? "commentary_viewed" : "commentary_hidden", {
            // these two || alternatives are kinda hacks, but they do the job for now
            commentary: element.data("commentary") || "<translation>",
            section: element.data("section-label") || label.replace("-translation", ""),
          });
        };
      };
      clickListener = clickListener(setShownState, commentaryRows, label);

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
    const sections = $container.find(".english-div");
    for (var i = 0; i < sections.length; i++) {
      const section = $(sections[i]);
      section.betterDoubleClick(this._englishClickListener(section));
    }
  };

  _englishClickListener(element) {
    return () => element.toggleClass("line-clampable");
  }

  _createContainerHtml(containerData) {
    const output = [`<h2>${containerData.title}</h2>`];
    if (containerData.loading) {
      output.push('<div class="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active"></div>');
    }
    for (var i = 0; i < containerData.sections.length; i++) {
      const section = containerData.sections[i];
      if (i !== 0 && section.steinsaltz_start_of_sugya) {
        output.push('<br class="sugya-separator">');
      }
      const sectionLabel = `${containerData.id}_section_${i+1}`;
      output.push(
        `<div id="${sectionLabel}" class="section-container" sefaria-ref="${section["ref"]}" main-source="true">`);

      output.push(
        this._tableRow(
          `<div class="gemara" id="${sectionLabel}-gemara">${section.he}</div>`,
          this._translationOption === "english-side-by-side" ? section.en : undefined,
          {classes: ["gemara-container"]}));
      if (section.commentary) {
        output.push(this._commentaryRowOutput(sectionLabel, section.commentary));
      }

      output.push("</div>");
    }
    return output.join("");
  }

  _applyClientSideDataTransformations(containerData) {
    if (!containerData.sections) {
      containerData.sections = [];
    }
    for (const section of containerData.sections) {
      const commentaries = section.commentary;

      if (commentaries) {
        if (this._translationOption === "both") {
          commentaries.Translation = commentaries.Steinsaltz;
          if (commentaries.Translation) {
            // e.g. Hadran sections have no steinsaltz
            commentaries.Translation.comments[0].en = section.en;
          }
          delete commentaries.Steinsaltz;
        }
      }
    }
  }

  // containerData is an awkward name, but "section" was already taken. Perhaps that can be changed
  // and then we can switch this over?
  renderContainer(containerData, divId) {
    debugResultsData[containerData.id] = containerData;
    this._applyClientSideDataTransformations(containerData);

    const $container = $(`#${divId}`);
    $container.html(this._createContainerHtml(containerData));

    this._setCommentaryButtons($container);
    this._setEnglishClickListeners($container);

    onceDocumentReady.execute(() => {
      const rows = $container.find(".table-row");
      for (var i = 0; i < rows.length; i++) {
        const row = $(rows[i])[0];
        this._setMaxLines($(row));
      }
    });
    // Make sure mdl always registers new views correctly
    componentHandler.upgradeAllRegistered();
  };

  _setMaxLines(row) {
    const hebrew = $(row.children()[0]);
    const english = $(row.find(".english-div")[0]);
    const maxLines = Math.floor(hebrew.height() / english.height());
    if (maxLines > 1) { // Also checks that maxLines is not NaN
      english.css("-webkit-line-clamp", maxLines.toString());
    }
  }
}

const findSefariaRef = function(node) {
  var isEnglish = false;
  while (node.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.attr("commentary-kind") === "Translation";
    const ref = $parentElement.attr("sefaria-ref");
    if (ref) {
      if (isEnglish && isTranslationOfSourceText) {
        // Go up one layer to the main text
        isEnglish = false;
      } else {
        return {
          ref: ref,
          text: $($parentElement.find(".hebrew")[0]).text(),
          translation: isTranslationOfSourceText
            ? undefined
            : $($parentElement.find(".english")[0]).text(),
        };
      }
    }
    node = node.parentNode;
  }
  return {};
}

// TODO: should this be in talmud_page.js?
var selectionChangeSnackbarShowing = false;
const hideSelectionChangeSnackbar = (ref) => {
  if (selectionChangeSnackbarShowing) {
    gtag("event", "selection_change_snackbar.hidden", {ref: ref});
    selectionChangeSnackbarShowing = false;
    hideSnackbar();
  }
};

document.addEventListener('selectionchange', () => {
  const selection = document.getSelection();
  if (selection.type !== "Range") {
    hideSelectionChangeSnackbar();
    return;
  }
  const sefariaRef = findSefariaRef(selection.anchorNode);
  if (!sefariaRef.ref
      // If the selection spans multiple refs, ignore them all
      || sefariaRef.ref !== findSefariaRef(selection.focusNode).ref) {
    hideSelectionChangeSnackbar(sefariaRef.ref);
    return;
  }
  const ref = sefariaRef.ref;
  const sefariaUrl = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  gtag("event", "selection_change_snackbar.shown", {ref: ref});
  selectionChangeSnackbarShowing = true;
  displaySnackbar(ref, [
    {
      text: "View on Sefaria",
      onClick: () => {
        window.location = sefariaUrl;
        gtag("event", "view_on_sefaria", {ref: ref});
      },
    },
    {
      text: "Report correction",
      onClick: () => {
        gtag("event", "report_correction", {ref: ref});
        const subject = "Sefaria Text Correction from talmud.page";
        var body = [
          `${ref} (${sefariaUrl})`,
          sefariaRef.text,
        ];
        if (sefariaRef.translation && sefariaRef.translation !== "") {
          body.push(sefariaRef.translation);
        }
        // trailing newline so that the description starts on its own line
        body.push("Describe the error:\n");

        body = body.join("\n\n");
        // TODO: verify the iOS versions. Also verify what non-Gmail clients do
        if (/(Android|iPhone|iPad|iOS)/.test(navigator.userAgent)) {
          body = body.replace(/\n/g, "<br>");
        }
        body = encodeURIComponent(body);
        window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
      },
    },
  ]);
});

class TalmudRenderer extends Renderer {
  constructor(translationOption) {
    super(TalmudRenderer._defaultCommentaryTypes(), translationOption);
  }

  static _defaultCommentaryTypes() {
    const commentaryTypes = [
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
        englishName: "Rabbeinu Chananel",
        hebrewName: 'ר"ח',
        className: "rabbeinu-chananel",
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
        englishName: "Meir Lublin",
        hebrewName: 'מהר"ם לובלין',
        className: "meir-lublin",
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

    const steinsaltz = {
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
