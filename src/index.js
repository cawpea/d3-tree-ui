import { D3TreeUI } from "./d3-tree-ui";

(function () {
  new D3TreeUI({
    selector: ".tree-wrap",
    json: "./data/sample-data.json",
    addToBottom: ".js-tree-addnode-bottom",
    addToRight: ".js-tree-addnode-right",
    nodeWidth: 200,
    nodeHeight: 32,
    nodeMargin: 8,
  });
})();
