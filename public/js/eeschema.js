(function (global) {
  var SchematicComponent = global.EESCHEMA.SchematicComponent,
      Schematic = global.EESCHEMA.Schematic;

  var dropTarget = document.querySelector("#drop_target");
  var fileInput = dropTarget.querySelector("input[type=file]");
  var componentsSection = document.querySelector("#components");
  var actionsSection = document.querySelector("#actions");
  var saveButton = document.querySelector("#save_schematic_button");
  var componentsTableBody = componentsSection.querySelector("tbody");
  var statusLine = document.querySelector("#status_line");
  var schematic;

  // Entry point for the full text of the file
  function processFile(text) {
    // Load and process schematic file
    try {
      schematic = new Schematic(text);
      dropTarget.classList.add("gone");
    } catch (ex) {
      writeErrorStatus(ex);
    }

    var sortedComponents = schematic.getDistinctComponents()
          .sort(SchematicComponent.MakeCompareFunction());

    populateTable(sortedComponents);
    componentsSection.classList.remove("gone");
    actionsSection.classList.remove("gone");
  }

  function populateTable(components) {
    var i = 0,
        cCount = components.length,
        row;

    while (i < cCount) {
      row = createComponentRow(components[i], i);
      componentsTableBody.appendChild(row);

      // Refer back to the index in list of components
      componentsTableBody.lastElementChild.dataset.componentIndex = i;
      i++;
    }
  }

  function createComponentRow(component) {
    var componentRowTemplate = document.querySelector("#component_row");
    var row = document.importNode(componentRowTemplate.content, true);
    var cells = row.querySelectorAll("td");
    cells[0].textContent = component.reference;
    cells[1].textContent = component.value;
    cells[2].textContent = component.componentName;
    cells[3].textContent = component.footprintName;
    return row;
  }

  // --------------------------------------------------------------------------

  function writeStatus(msg) {
    statusLine.classList.remove("error");
    statusLine.innerText = msg;
  }

  function writeErrorStatus(msg) {
    console.error(msg);
    statusLine.classList.add("error");
    statusLine.innerText = msg;
  }

  function onDragLeave() {
    dropTarget.classList.remove("dragover");
  }

  dropTarget.addEventListener("dragover", function (ev) {
    ev.preventDefault();
    dropTarget.classList.add("dragover");
  });

  dropTarget.addEventListener("dragend", onDragLeave);
  dropTarget.addEventListener("dragleave", onDragLeave);
  dropTarget.addEventListener("drop", onDragLeave);

  function readFile(f) {
    var reader = new FileReader();
    reader.onload = function (e) {
      writeStatus("Read file");
      processFile(e.target.result);
      writeStatus("Processed file");
    }

    reader.onerror = function (err) {
      writeErrorStatus("Failed to read dropped file");
    }

    reader.readAsText(f);
  }


  dropTarget.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();
    readFile(e.dataTransfer.files[0]);
    return false;
  });

  fileInput.addEventListener("change", function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (fileInput.value === "") return;
    readFile(fileInput.files[0]);
  });

  // On clicking save button, start a download a plaintext .sch file
  // This is a bit hacky, works by creating an <a> element with a href
  // containing a data uri with the full text of the file, with the download
  // attribute.
  // Seen at
  // https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
  saveButton.addEventListener("click", function (e) {
    var a = document.createElement("a");
    a.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," 
        + encodeURIComponent(schematic.generateFile()));
    a.setAttribute("download", "schematic.sch"); // TODO get orig filename?
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

}(window));
