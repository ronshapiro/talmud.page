/* global gtag,  */
import $ from "jquery";
import {driveClient} from "./google_drive/singleton";
import {snackbars} from "./snackbar";

let selectionSnackbarRef: string | undefined;
const hideSelectionChangeSnackbar = (ref?: string) => {
  if (selectionSnackbarRef) {
    gtag("event", "selection_change_snackbar.hidden", {ref});
    selectionSnackbarRef = undefined;
    snackbars.textSelection.hide();
  }
};

interface Metadata {
  ref: string,
  parentRef: string,
  link: string,
  text: string,
  translation: string | undefined,
  amud: string,
}

type FindSefariaRefReturnType = Metadata | undefined;
const findSefariaRef = (node: Node | null): FindSefariaRefReturnType => {
  let isEnglish = false;
  while (node?.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.hasClass("translation");
    const ref = $parentElement.attr("sefaria-ref");
    if (ref === "ignore") {
      break;
    }
    if (ref && ref !== "synthetic") {
      if (isEnglish && isTranslationOfSourceText) {
        // Go up one layer to the main text
        isEnglish = false;
      } else {
        return {
          ref,
          parentRef: $parentElement.parent().closest("[sefaria-ref]").attr("sefaria-ref") as string,
          link: $parentElement.attr("tp-link") as string,
          text: $($parentElement.find(".hebrew")[0]).text(),
          translation: isTranslationOfSourceText
            ? undefined
            : $($parentElement.find(".english")[0]).text(),
          amud: $parentElement.closest(".amudContainer").attr("amud") as string,
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
          sefariaRef.text,
        ];
        if (sefariaRef.translation && sefariaRef.translation !== "") {
          bodyParts.push(sefariaRef.translation);
        }
        // trailing newline so that the description starts on its own line
        bodyParts.push("Describe the error:");

        const body = encodeURIComponent(bodyParts.join("\n\n"));
        window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
      },
    },
  );
  if (driveClient.isSignedIn && !driveClient.errors.length) {
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
        // Get the possibly-updated selection
        const selectedText = document.getSelection()?.toString() ?? "";
        noteTextArea.val("");
        $("#modal-cancel").off("click").on("click", () => modalContainer.hide());
        $("#modal-save").off("click").on("click", () => {
          driveClient.postComment({
            text: noteTextArea.val() as string || "",
            selectedText,
            amud: sefariaRef.amud,
            ref: sefariaRef.ref,
            parentRef: sefariaRef.parentRef || sefariaRef.ref,
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
