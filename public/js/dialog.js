(function (global) {
  var Dialog = function(dialogElement) {
    var dialogForm = dialogElement.querySelector("form[method=dialog]"),
        inputHiddenCanceled,
        cancelButton,
        self = this;

    this.dialog = dialogElement;
    this.dialogForm = dialogForm;
    this.cancelButton = null;
    this.onsubmit = null;
    this.oncancel = null;
    this.onclose = null;
    this._handlers = {
      "onsubmit": onsubmit.bind(this),
      "oncancelClick": oncancelClick.bind(this),
    };

    if (dialogForm !== null) {
      dialogForm.addEventListener("submit", this._handlers.onsubmit);

      this.cancelButton = dialogForm.querySelector("button[value=cancel]");

      if (this.cancelButton) {
        this.cancelButton.addEventListener(
          "click", this._handlers.oncancelClick);

        inputHiddenCanceled = dialogForm.querySelector("input[name=canceled");

        if (!inputHiddenCanceled) {
          inputHiddenCanceled = document.createElement("input");
          inputHiddenCanceled.setAttribute("name", "canceled");
          inputHiddenCanceled.setAttribute("type", "hidden");
          dialogForm.appendChild(inputHiddenCanceled);
        }

        inputHiddenCanceled.value = null;
      }
    }
  };

  Dialog.prototype.hasForm = function () {
    return typeof this.dialogForm !== "undefined";
  };

  Dialog.prototype.showModal = function (reset) {
    var firstEl,
        form,
        inputHiddenCanceled;

    this.dialog.setAttribute("open", "open");

    if (!this.hasForm()) return;

    form = this.dialogForm;

    inputHiddenCanceled = form.querySelector("input[name=canceled");

    if (inputHiddenCanceled) inputHiddenCanceled.value = null;

    if (reset) form.reset();

    firstEl = form.elements[0];
    if (firstEl) firstEl.focus();
  };

  Dialog.prototype.close = function () {
    this.dialog.removeAttribute("open");

    if (typeof this.onclose === "function") this.onclose();
    this.dialogForm.removeEventListener("submit", this._handlers.onsubmit);
    if (this.cancelButton) {
      this.cancelButton.removeEventListener(
        "click", this._handlers.oncancelClick);
    }
  };

  Dialog.prototype.getFormData = function (submitEvent) {
    var formData,
        entry,
        data = {};

    if (!this.hasForm()) return null;

    formData = new FormData(this.dialogForm);

    for (entry of formData.entries()) {
      data[entry[0]] = entry[1];
    }

    return data;
  };

  Dialog.prototype.setTitle = function (title) {
    var header = this.dialog.querySelector("header");
    if (header) header.textContent = title;
  };

  function onsubmit(e) {
    var inputHiddenCanceled = this.dialogForm
                                  .querySelector("input[name=canceled");

    e.preventDefault();

    if (inputHiddenCanceled && inputHiddenCanceled.value) {
      if (typeof this.oncancel === "function") this.oncancel();
    } else {
      if (typeof this.onsubmit === "function") {
        this.onsubmit(this.getFormData());
      }
    }

    this.close();
  }

  function oncancelClick(e) {
    var canceledInput =  this.dialogForm.querySelector("input[name=canceled");
    if (canceledInput) canceledInput.value = 1;
  }

  window.EESCHEMA.Dialog = Dialog;
}(window));
