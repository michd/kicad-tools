(function (global) {
  var SchematicComponent = global.EESCHEMA.SchematicComponent,
      Schematic = global.EESCHEMA.Schematic;

  var dropTarget = document.querySelector("#drop_target");
  var componentsSection = document.querySelector("#components");
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
      writeError(ex);
    }

    var sortedComponents = schematic.components
          .slice()
          .sort(SchematicComponent.MakeCompareFunction());

    populateTable(sortedComponents);
    componentsSection.classList.remove("gone");
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
    cells[2].textContent = component.name;
    cells[3].textContent = component.footprintName;
    return row;
  }


  // --------------------------------------------------------------------------

  function writeStatus(msg) {
    statusLine.classList.remove("error");
    statusLine.innerText = msg;
  }

  function writeErrorStatus(msg) {
    statusLine.classList.remove("error");
    statusLine.innterText = msg;
  }

  function onDragLeave() {
    dropTarget.classList.remove("dragover");
  }

  dropTarget.addEventListener("dragover", function (ev) {
    ev.preventDefault();
    console.log("dragover");
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
      writeError("Failed to read dropped file");
    }

    reader.readAsText(f);
  }


  dropTarget.addEventListener("drop", function (e) {
    e.stopPropagation();
    e.preventDefault();
    console.log("drop.", e.dataTransfer.files.length);
    e.preventDefault();
    readFile(e.dataTransfer.files[0]);
    return false;
  });

}(window));
