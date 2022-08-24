/* global gtag,  */
import {showCorrectionModal} from "./CorrectionModal";
import {findNodeOffset} from "./dom";
import {driveClient} from "./google_drive/singleton";
import {AnyComment, CommentSourceMetadata, HighlightColor} from "./google_drive/types";
import {applyHighlight} from "./highlight";
import {$} from "./jquery";
import {Button, snackbars} from "./snackbar";
import {checkNotUndefined} from "./undefined";

let selectionSnackbarRef: string | undefined;
const hideSelectionChangeSnackbar = () => {
  if (selectionSnackbarRef) {
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
  isPersonalNote: boolean;
  highlightId: string | undefined;
}

type FindSefariaRefReturnType = Metadata | undefined;
const findSefariaRef = (node: Node | null): FindSefariaRefReturnType => {
  let isEnglish = false;
  let hasFoundEnglishAndTranslationElement = false;
  let highlightId;
  while (node?.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.hasClass("translation");
    const ref = $parentElement.attr("sefaria-ref");
    highlightId ||= $parentElement.attr("highlight-id");
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
          hebrew: nodeAndText($parentElement.find(".hebrew, .hebrew-ref-text")[0]),
          translation: isTranslationOfSourceText
            ? undefined
            : nodeAndText($parentElement.find(".english, .english-ref-text")[0]),
          amud: $parentElement.closest(".amudContainer").attr("amud") as string,
          isEnglish,
          isPersonalNote: $parentElement.hasClass('personal-notes'),
          highlightId,
        };
      }
    }
    node = node.parentNode;
  }
  return undefined;
};

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
    hideSelectionChangeSnackbar();
    return undefined;
  }
  if (sefariaRef.ref === selectionSnackbarRef) {
    // do nothing, since the snackbar is already showing the right information
    return undefined;
  }
  return sefariaRef;
};

function talmudPageLinkButton({ref, link}: Metadata): Button {
  return {
    text: '<i class="material-icons">open_in_browser</i>',
    onClick: () => {
      gtag("event", "view_on_talmud_page", {ref});
      window.open(link + `?ref_link=${ref}`);
    },
  };
}

function viewOnSefariaButton(ref: string, sefariaUrl: string): Button {
  return {
    text: '<i class="material-icons">open_in_new</i>',
    onClick: () => {
      gtag("event", "view_on_sefaria", {ref});
      window.open(sefariaUrl);
    },
  };
}

class SelectionState {
  private selectedText: string | undefined;
  private commentSourceMetadata: CommentSourceMetadata | undefined;

  constructor(private sefariaRef: Metadata) {}

  getSelectedText(): string {
    return checkNotUndefined(this.selectedText, "selectedText");
  }

  getCommentSourceMetadata(): CommentSourceMetadata {
    return checkNotUndefined(this.commentSourceMetadata, "commentSourceMetadata");
  }

  capture() {
    const selection = document.getSelection()!;
    this.selectedText = selection.toString().trim() ?? "";
    const {isEnglish, hebrew, translation} = this.sefariaRef;
    const entireNodeAndText = isEnglish ? translation : hebrew;
    if (entireNodeAndText === undefined) {
      throw new Error(`Text is undefined: ${JSON.stringify(this.sefariaRef)}`);
    }
    const end = (
      findNodeOffset(entireNodeAndText.node, selection.focusNode!) + selection.focusOffset);
    const start = end - this.selectedText.length;
    const entireText = entireNodeAndText.text;
    const wordCount = (str: string) => Array.from(str.split(" ")).length - 1;
    this.commentSourceMetadata = {
      startPercentage: start / entireText.length,
      endPercentage: end / entireText.length,
      wordCountStart: wordCount(entireText.slice(0, start)),
      wordCountEnd: wordCount(entireText.slice(end)),
      isEnglish,
    };
  }
}

function deleteCommentButton({ref}: Metadata): Button {
  return {
    text: '<i class="material-icons">delete</i>',
    onClick: () => driveClient.deleteComment(ref),
  };
}

const REPORT_CORRECTION_HTML = '<i class="material-icons">build</i>';

function reportLoggedOutCorrection(
  {ref, hebrew, translation}: Metadata, sefariaUrl: string): Button {
  return {
    text: REPORT_CORRECTION_HTML,
    onClick: () => {
      gtag("event", "report_correction", {ref});
      const subject = "Sefaria Text Correction from talmud.page";
      const bodyParts = [
        `${ref} (${sefariaUrl})`,
        hebrew.text,
      ];
      if (translation && translation.text !== "") {
        bodyParts.push(translation.text);
      }
      // trailing newline so that the description starts on its own line
      bodyParts.push("Describe the error:");

      const body = encodeURIComponent(bodyParts.join("\n\n"));
      window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
    },
  };
}

class Buttons {
  constructor(
    private sefariaRef: Metadata,
    private sefariaUrl: string,
    private selectionState: SelectionState,
  ) {}


  reportLoggedInCorrection(): Button {
    return {
      text: REPORT_CORRECTION_HTML,
      onClick: () => {
        this.selectionState.capture();
        const maybeHighlight = (
          text: string | undefined,
          isEnglish: boolean,
        ): string | undefined => {
          if (!text) {
            return undefined;
          }
          if (this.sefariaRef.isEnglish !== isEnglish) {
            return text;
          }
          return applyHighlight({
            // This is a workaround - email is selected down below and this is ignored.
            highlight: "yellow",
            commentSourceMetadata: this.selectionState.getCommentSourceMetadata(),
            text: this.selectionState.getSelectedText(),
          }, text, "email");
        };
        const hebrew = this.sefariaRef.hebrew?.text;
        const translation = this.sefariaRef.translation?.text;
        showCorrectionModal({
          ref: this.sefariaRef.ref,
          url: this.sefariaUrl,
          hebrew,
          hebrewHighlighted: maybeHighlight(hebrew, false),
          translation,
          translationHighlighted: maybeHighlight(translation, true),
          pathname: window.location.pathname,
        });
      },
    };
  }

  private postComment(comment: AnyComment) {
    driveClient.postComment({
      comment,
      selectedText: this.selectionState.getSelectedText(),
      amud: this.sefariaRef.amud,
      ref: this.sefariaRef.ref,
      parentRef: this.sefariaRef.parentRef || this.sefariaRef.ref,
    });
  }

  boldTextButton(): Button {
    return {
      text: '<i class="material-icons">format_bold</i>',
      onClick: () => {
        this.selectionState.capture();
        const newButton = (color: HighlightColor) => {
          return {
            text: `<i class="material-icons icon-highlight-${color}">palette</i>`,
            onClick: () => {
              this.postComment({
                highlight: color,
                commentSourceMetadata: this.selectionState.getCommentSourceMetadata(),
              });
              snackbars.textSelection.hide();
            },
          };
        };
        snackbars.textSelection.update(
          "", [
            newButton("red"),
            newButton("yellow"),
            newButton("green"),
            newButton("blue"),
            newButton("gray"),
          ]);
      },
    };
  }

  deleteBoldButton(): Button {
    return {
      text: `<span class="stacked_mdl_icons">
        <i class="material-icons">format_bold</i>
        <i class="material-icons" style="color: var(--snackbar-disabled-button-color); font-size: 32px">hide_source</i>
      </span>`,
      onClick: () => driveClient.deleteHighlight(this.sefariaRef.highlightId),
    };
  }

  addCommentButton(): Button {
    const {ref} = this.sefariaRef;
    return {
      text: '<i class="material-icons">add_comment</i>',
      onClick: () => {
        this.showCommentEditorModal({
          initialText: "",
          title: `Add a note on ${ref}`,
          onSave: (text: string) => this.postComment({
            text,
            commentSourceMetadata: this.selectionState.getCommentSourceMetadata(),
          }),
          direction: "rtl",
        });
      },
    };
  }

  editPersonalCommentButton(): Button {
    const {ref} = this.sefariaRef;
    return {
      text: '<i class="material-icons">edit</i>',
      onClick: () => {
        const [initialText, isRtl] = driveClient.currentCommentText(ref);
        this.showCommentEditorModal({
          initialText,
          title: `Edit note`,
          onSave: (text: string) => driveClient.updateComment(ref, text),
          direction: isRtl ? "rtl" : "ltr",
        });
      },
    };
  }

  private showCommentEditorModal({
    initialText,
    title,
    onSave,
    direction,
  }: {
    initialText: string,
    title: string,
    onSave: (newText: string) => void,
    direction: "ltr" | "rtl",
  }) {
    const modalContainer = $("#modal-container");
    const noteTextArea = $("#personal-note-entry");
    const ltrButton = $("#modal-ltr");
    const rtlButton = $("#modal-rtl");

    noteTextArea.attr("dir", direction);
    (direction === "ltr" ? rtlButton : ltrButton).removeClass("modal-direction-active");
    (direction === "ltr" ? ltrButton : rtlButton).addClass("modal-direction-active");
    $(".modal-direction").off("click").on("click", () => {
      noteTextArea.attr("dir", noteTextArea.attr("dir") === "ltr" ? "rtl" : "ltr");
      ltrButton.toggleClass("modal-direction-active");
      rtlButton.toggleClass("modal-direction-active");
      noteTextArea.focus();
    });

    $("#modal-label").text(title);
    noteTextArea.val(initialText);
    $("#modal-cancel").off("click").on("click", () => modalContainer.hide());

    this.selectionState.capture();
    $("#modal-save").off("click").on("click", () => {
      onSave(noteTextArea.val() as string || "");
      modalContainer.hide();
    });
    modalContainer.show();
    noteTextArea.focus();
  }
}

const onSelectionChange = () => {
  const sefariaRef = findSefariaRefOrHideSnackbar();
  if (!sefariaRef) {
    return;
  }

  const {ref} = sefariaRef;
  const sefariaUrl = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  selectionSnackbarRef = ref;
  const buttons = [];
  if (sefariaRef.link) {
    buttons.push(talmudPageLinkButton(sefariaRef));
  }
  buttons.push(viewOnSefariaButton(ref, sefariaUrl));

  if (driveClient.allowCommenting() && ref !== "ignore-drive") {
    const buttonsImpl = new Buttons(sefariaRef, sefariaUrl, new SelectionState(sefariaRef));
    if (sefariaRef.isPersonalNote) {
      buttons.push(buttonsImpl.editPersonalCommentButton());
      buttons.push(deleteCommentButton(sefariaRef));
    } else {
      buttons.push(buttonsImpl.reportLoggedInCorrection());
      buttons.push(buttonsImpl.boldTextButton());
      if (sefariaRef.highlightId) {
        buttons.push(buttonsImpl.deleteBoldButton());
      }
    }

    buttons.push(buttonsImpl.addCommentButton());
  } else {
    buttons.push(reportLoggedOutCorrection(sefariaRef, sefariaUrl));
  }

  const hideRef = (
    window.location.hostname !== "localhost" && window.location.pathname.startsWith("/Siddur"));
  snackbars.textSelection.show(hideRef ? "" : ref, buttons);
};

module.exports = {
  registerRefSelectionSnackbarListener: () => {
    document.addEventListener("selectionchange", onSelectionChange);
  },
};
