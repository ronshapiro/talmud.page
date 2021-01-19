/* global gtag,  */
import {findNodeOffset} from "./dom";
import {driveClient} from "./google_drive/singleton";
import {AnyComment, CommentSourceMetadata} from "./google_drive/types";
import {$} from "./jquery";
import {snackbars} from "./snackbar";
import {checkNotUndefined} from "./undefined";

let selectionSnackbarRef: string | undefined;
const hideSelectionChangeSnackbar = (ref?: string) => {
  if (selectionSnackbarRef) {
    gtag("event", "selection_change_snackbar.hidden", {ref});
    selectionSnackbarRef = undefined;
    snackbars.textSelection.hide();
  }
};

interface NodeAndText {
  node: Node;
  text: string;
}

const nodeAndText = (node: Node) => {
  return {node, text: $(node).text()};
};

interface Metadata {
  ref: string,
  parentRef: string,
  link: string,
  hebrew: NodeAndText,
  translation: NodeAndText | undefined,
  amud: string,
  isEnglish: boolean;
}

type FindSefariaRefReturnType = Metadata | undefined;
const findSefariaRef = (node: Node | null): FindSefariaRefReturnType => {
  let isEnglish = false;
  let hasFoundEnglishAndTranslationElement = false;
  while (node?.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.hasClass("translation");
    const ref = $parentElement.attr("sefaria-ref");
    if (ref === "ignore") {
      break;
    }
    if (ref && ref !== "synthetic") {
      if (isEnglish && isTranslationOfSourceText && !hasFoundEnglishAndTranslationElement) {
        // Go up one layer to the main text
        hasFoundEnglishAndTranslationElement = true;
      } else {
        return {
          ref,
          parentRef: $parentElement.parent().closest("[sefaria-ref]").attr("sefaria-ref") as string,
          link: $parentElement.attr("tp-link") as string,
          hebrew: nodeAndText($parentElement.find(".hebrew")[0]),
          translation: isTranslationOfSourceText
            ? undefined
            : nodeAndText($parentElement.find(".english")[0]),
          amud: $parentElement.closest(".amudContainer").attr("amud") as string,
          isEnglish,
        };
      }
    }
    node = node.parentNode;
  }
  return undefined;
};

const onSelectionChange = () => {
  const findSefariaRefOrHideSnackbar = (): FindSefariaRefReturnType => {
    const selection = document.getSelection() as Selection;
    const $anchorNode = $(selection.anchorNode as any) as JQuery;
    if ($anchorNode.closest("#snackbar").length > 0) {
      return undefined;
    }

    if (selection.type !== "Range") {
      hideSelectionChangeSnackbar();
      return undefined;
    }

    const sefariaRef = findSefariaRef(selection.anchorNode);
    if (sefariaRef === undefined
        || !sefariaRef.ref
        // TODO: perhaps support multiple refs, and just grab everything in between?
        // If the selection spans multiple refs, ignore them all
        || sefariaRef.ref !== findSefariaRef(selection.focusNode)?.ref) {
      hideSelectionChangeSnackbar(sefariaRef?.ref);
      return undefined;
    }
    if (sefariaRef.ref === selectionSnackbarRef) {
      // do nothing, since the snackbar is already showing the right information
      return undefined;
    }
    return sefariaRef;
  };
  const sefariaRef = findSefariaRefOrHideSnackbar();
  if (!sefariaRef) {
    return;
  }

  const {ref, link} = sefariaRef;
  const sefariaUrl = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  gtag("event", "selection_change_snackbar.shown", {ref});
  selectionSnackbarRef = ref;
  const buttons = [];
  if (link) {
    buttons.push({
      text: '<i class="material-icons">open_in_browser</i>',
      onClick: () => {
        gtag("event", "view_on_talmud_page", {ref});
        window.open(link + `?ref_link=${ref}`);
      },
    });
  }
  buttons.push(
    {
      text: '<i class="material-icons">open_in_new</i>',
      onClick: () => {
        gtag("event", "view_on_sefaria", {ref});
        window.open(sefariaUrl);
      },
    },
    {
      text: '<i class="material-icons">build</i>',
      onClick: () => {
        gtag("event", "report_correction", {ref});
        const subject = "Sefaria Text Correction from talmud.page";
        const bodyParts = [
          `${ref} (${sefariaUrl})`,
          sefariaRef.hebrew.text,
        ];
        if (sefariaRef.translation && sefariaRef.translation.text !== "") {
          bodyParts.push(sefariaRef.translation.text);
        }
        // trailing newline so that the description starts on its own line
        bodyParts.push("Describe the error:");

        const body = encodeURIComponent(bodyParts.join("\n\n"));
        window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
      },
    },
  );

  if (driveClient.isSignedIn && !driveClient.hasErrors() && ref !== "ignore-drive") {
    let selectedText: string;
    let commentSourceMetadata: CommentSourceMetadata | undefined;
    const captureSelectionState = () => {
      const selection = document.getSelection()!;
      selectedText = selection.toString().trim() ?? "";
      const {isEnglish, hebrew, translation} = sefariaRef;
      const entireNodeAndText = isEnglish ? translation : hebrew;
      if (entireNodeAndText === undefined) {
        throw new Error(`Text is undefined: ${JSON.stringify(sefariaRef)}`);
      }
      const end = (
        findNodeOffset(entireNodeAndText.node, selection.focusNode!) + selection.focusOffset);
      const start = end - selectedText.length;
      const entireText = entireNodeAndText.text;
      const wordCount = (str: string) => Array.from(str.split(" ")).length - 1;
      commentSourceMetadata = {
        startPercentage: start / entireText.length,
        endPercentage: end / entireText.length,
        wordCountStart: wordCount(entireText.slice(0, start)),
        wordCountEnd: wordCount(entireText.slice(end)),
        isEnglish,
      };
    };
    const postComment = (comment: AnyComment) => {
      driveClient.postComment({
        comment,
        selectedText: checkNotUndefined(selectedText, "selectedText"),
        amud: sefariaRef.amud,
        ref: sefariaRef.ref,
        parentRef: sefariaRef.parentRef || sefariaRef.ref,
      });
    };

    buttons.push({
      text: '<i class="material-icons">format_bold</i>',
      onClick: () => {
        captureSelectionState();
        postComment({
          highlight: true,
          commentSourceMetadata: checkNotUndefined(commentSourceMetadata, "commentSourceMetadata"),
        });
      },
    });

    buttons.push({
      text: '<i class="material-icons">add_comment</i>',
      onClick: () => {
        const modalContainer = $("#modal-container");
        const noteTextArea = $("#personal-note-entry");
        const ltrButton = $("#modal-ltr");
        const rtlButton = $("#modal-rtl");

        noteTextArea.attr("dir", "rtl");
        ltrButton.removeClass("modal-direction-active");
        rtlButton.addClass("modal-direction-active");
        $(".modal-direction").off("click").on("click", () => {
          noteTextArea.attr("dir", noteTextArea.attr("dir") === "ltr" ? "rtl" : "ltr");
          ltrButton.toggleClass("modal-direction-active");
          rtlButton.toggleClass("modal-direction-active");
        });

        modalContainer.show();
        $("#modal-label").text(`Add a note on ${sefariaRef.ref}`);
        noteTextArea.val("");
        $("#modal-cancel").off("click").on("click", () => modalContainer.hide());

        captureSelectionState();
        $("#modal-save").off("click").on("click", () => {
          const text = noteTextArea.val() as string || "";
          postComment({
            text,
            commentSourceMetadata: checkNotUndefined(
              commentSourceMetadata, "commentSourceMetadata"),
          });
          modalContainer.hide();
        });
      },
    });
  }

  snackbars.textSelection.show(ref, buttons);
};

module.exports = {
  registerRefSelectionSnackbarListener: () => {
    document.addEventListener("selectionchange", onSelectionChange);
  },
};
