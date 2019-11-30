(function (global) {
  var Dialog = window.EESCHEMA.Dialog;

  var MultipleChoiceDialog = function (title, textContent, choices) {
    var dialogElement = document.querySelector("#multiple_choice_dialog");

    Dialog.call(this, dialogElement);

    title = title || "";
    textContent = textContent || "";
    choices = choices || [];

    this.fieldset = this.dialogForm.querySelector("fieldset");
    this.contentDiv = dialogElement.querySelector(".dialog_content");

    this.setTitle(title);
    this.setContent(textContent);
    this.setChoices(choices);
  };

  MultipleChoiceDialog.prototype = Object.create(Dialog.prototype);
  MultipleChoiceDialog.constructor = MultipleChoiceDialog;

  MultipleChoiceDialog.prototype.setContent = function (content) {
    while (this.contentDiv.hasChildNodes()) {
      this.contentDiv.removeChild(this.contentDiv.lastChild);
    }

    this.contentDiv.append(content);
  };

  MultipleChoiceDialog.prototype.setChoices = function (choices) {
    while (this.fieldset.hasChildNodes()) {
      this.fieldset.removeChild(this.fieldset.lastChild);
    }

    for (choice of choices) {
      this.fieldset.appendChild(buildChoice(choice.value, choice.label));
    }
  };

  function buildChoice(value, labelText) {
    var label = document.createElement("label");
    var radioInput = document.createElement("input");
    radioInput.setAttribute("type", "radio");
    radioInput.setAttribute("name", "choice");
    radioInput.setAttribute("value", value);

    label.appendChild(radioInput);
    label.append(labelText);

    return label;
  }

  window.EESCHEMA.MultipleChoiceDialog = MultipleChoiceDialog;
}(window));
