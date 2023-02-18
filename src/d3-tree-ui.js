import * as d3 from "d3";
import "./d3-tree-ui.scss";

const MARGIN = {
  CONTAINER: {
    TOP: 30,
    BOTTOM: 50,
  },
  NODE: {
    LEFT: 10,
  },
  NODE_NAME: {
    LEFT: 20,
  },
};
const DEFAULT_DURATION = 500;

// ノード名の１行あたりの最大文字数（半角）
const NODE_NAME_LINE_MAX = 26;

// ノード更新時のメソッド識別用
const NODE_METHOD = {
  UPDATE_NAME: "updateName",
  TOGGLE_CHILDREN: "toggleChildren",
  DELETE_NODE: "deleteNode",
  APPEND_NODE_TEMP: "appendNodeTemp",
  MOVE_NODE: "moveNode",
};

const KEY_NUMBER = {
  8: "DELETE",
  9: "TAB",
  13: "ENTER",
  37: "LEFT",
  38: "TOP",
  40: "BOTTOM",
  39: "RIGHT",
};

// ノード追加時の位置
const APPEND_DIRECTION = {
  BOTTOM: "appendToBottom",
  RIGHT: "appendToRight",
};

// ノード移動時の位置
const MOVE_DIRECTION = {
  TOP: "moveTop",
  LEFT: "moveLeft",
  BOTTOM: "moveBottom",
  RIGHT: "moveRight",
};

class TreeUI {
  constructor(params) {
    const {
      selector,
      json,
      addToBottom,
      addToRight,
      nodeWidth,
      nodeHeight,
      nodeMargin,
      addable,
      editable,
      draggable,
    } = params;
    const $svgWrapper = document.querySelector(selector);
    const $svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    $svgWrapper.appendChild($svg);

    this.json = json;
    this.$svgWrap = d3.select($svgWrapper);
    this.$svg = d3.select($svg);
    this.$addNodeBottom = d3.select(addToBottom);
    this.$addNodeRight = d3.select(addToRight);
    this.columnWidth = nodeWidth || 200;
    this.textLineWidth = this.columnWidth - 50;
    this.textMinLength = 10;
    this.nodeHeight = nodeHeight || 30;
    this.rowHeight = this.nodeHeight + (nodeMargin || 0);
    this.addable = typeof addable === "boolean" ? addable : true;
    this.editable = typeof editable === "boolean" ? editable : true;
    this.draggable = typeof draggable === "boolean" ? draggable : true;
    this.init();
  }
  init() {
    this.getJsonData((data) => {
      this.bindEvents();
      this.initNodeData(data);
      this.updateUserInputNode();
      this.updateNodesLayout();
      this.initLayout();
      this.initNode();
    });
  }
  getJsonData(callback) {
    d3.json(this.json, (error, data) => {
      if (error) throw error;
      callback(data);
    });
  }
  bindEvents() {
    document.addEventListener("keydown", (e) => {
      this.onKeydownView(e);
    });
    this.$addNodeBottom.on("click", (e) => {
      this.onClickAddNode(APPEND_DIRECTION.BOTTOM);
    });
    this.$addNodeRight.on("click", (e) => {
      this.onClickAddNode(APPEND_DIRECTION.RIGHT);
    });
  }
  onKeydownView(e) {
    let selectedKey = KEY_NUMBER[e.which];
    let isMoveNode = selectedKey ? MOVE_DIRECTION[selectedKey] : null;

    if (selectedKey === "DELETE") {
      this.deleteSelectedNode();
    } else if (selectedKey === "ENTER" || selectedKey === "TAB") {
      e.preventDefault();
      let selectedNodes = this.getSelectedNodes();
      let direction =
        selectedKey === "TAB"
          ? APPEND_DIRECTION.RIGHT
          : APPEND_DIRECTION.BOTTOM;

      if (selectedNodes === null || selectedNodes.length === 0) {
        return;
      }

      let selectedNode = selectedNodes[0];
      this.appendTempNode(selectedNode, direction);
    } else if (isMoveNode) {
      let isEditingNode =
        this.nodeList.filter((d) => {
          return d._isEdit;
        }).length > 0;

      if (!isEditingNode) {
        this.moveSelectNode(MOVE_DIRECTION[selectedKey]);
        e.preventDefault();
      }
    }
  }
  onClickAddNode(direction) {
    let selectedNodes = this.getSelectedNodes();
    if (selectedNodes === null || selectedNodes.length === 0) {
      return;
    }

    let selectedNode = selectedNodes[0];
    this.appendTempNode(selectedNode, direction);
  }
  createNodeData(nodeObj) {
    return d3.hierarchy(nodeObj, (d) => {
      return d.children;
    });
  }
  initNodeData(jsonData) {
    this.nodes = this.createNodeData(jsonData);
    this.nodeList = this.nodes.descendants();
    this.nodeList = this.nodeList.map((d) => {
      d._isShow = true;
      d._isEdit = false;
      d._isDragging = false;
      return d;
    });
  }
  updateNodesLayout() {
    let isInitialLayout = this.$svg.attr("width") === null;

    //各子ノードに対して、親からのインデックス番号を保持する
    /*
    node.childIndex = 0
     |- node.childIndex = 0
     |- node.childIndex = 1
     |- node.childIndex = 2
        |- node.childIndex = 0
        |- node.childIndex = 1
    */
    this.setChildProperties(this.nodes, 0, true);

    // 各親ノードに対して、自分の子孫に存在する葉っぱの数を保持する。子→親の順番で保持する。
    /*
    node.leafLength = 3
     |- node.leafLength = 0 -- leave
     |- node.leafLength = 0 -- leave
     |- node.leafLength = 2
        |- node.leafLength = 0 -- leave
        |- node.leafLength = 0 -- leave
    */
    this.nodes.leaves().map((node) => {
      this.setLeafLength(node);
    });

    this.nodeList.map((node) => {
      // ノード名が長い場合に３点リーダー表示用プロパティ（ellipsisName）を設定する
      this.setNodeNameProperties(node);
      //各ノードに対して、縦方向の位置情報（インデックス番号）を割り当てる。親→子の順番で割り当てる。
      this.setVerticalIndex(node);
    });

    //各ノードのx,y座標を算出
    this.nodeList.map((d) => {
      d._x = d.depth * this.columnWidth;
      d._y = d._verticalIndex * this.rowHeight;
    });

    this.columnCount =
      d3.max(this.nodeList, (d) => {
        return d.depth;
      }) + 1;
    this.rowCount =
      d3.max(this.nodeList, (d) => {
        return d._verticalIndex;
      }) + 1;

    this.svgWidth = this.columnCount * this.columnWidth;
    this.svgHeight = this.rowCount * this.rowHeight + MARGIN.CONTAINER.BOTTOM;

    if (isInitialLayout) {
      this.$svg.attr("width", this.svgWidth).attr("height", this.svgHeight);
    } else {
      this.$svg
        .transition()
        .duration(DEFAULT_DURATION)
        .attr("width", this.svgWidth)
        .attr("height", this.svgHeight);
    }

    this.updateBackground();
  }
  calculateNodePathD(d) {
    if (!d || !d.parent) {
      return;
    }
    let margin = MARGIN.NODE.LEFT;
    let currentY = d._y;
    let parentY = d.parent._y;
    let diffY = currentY - parentY;
    if (diffY === 0) {
      return "M0,0 h10";
    } else {
      return `M0,${-diffY} q${margin / 2},0,${margin / 2},5 v${diffY - 10} q0,${
        margin / 2
      },${margin / 2},${margin / 2}`;
    }
  }
  /*
  子ノードのレイアウト設定処理。全ての子ノードに対して再帰的に実行する。

  @param node (Uo) ノード情報
  @param childIndex (int) 親ノードを基準のした場合のノードの位置インデックス
  @param isShow (Boolean) ノードを表示する場合はtrue、そうでない場合はfalse
  */
  setChildProperties(node, childIndex, isShow) {
    let children = this.getChildren(node);
    node._childIndex = childIndex;
    node._isShow = isShow;
    node._isTemp = !!node.data._isTemp;

    if (children && children.length > 0) {
      node._childrenLength = children.length;

      //親が閉じられている場合は全ての子ノードを非表示にする
      if (node._isToggleOpen === false) {
        isShow = false;
      }

      for (let i = 0, len = children.length; i < len; i++) {
        this.setChildProperties(children[i], i, isShow);
      }
    } else {
      node._childrenLength = 0;
    }
  }
  setLeafLength(node) {
    if (!this.hasChildren(node)) {
      node._leafLength = 0;
    } else {
      // 表示されているノードのみ葉っぱの個数に含める
      let showChildren = node.children.filter((d) => {
        return d._isShow;
      });
      let leafLength = showChildren.length;

      // 子ノードの葉っぱの数を自分の葉っぱの数に加える
      showChildren.map((n) => {
        if (n._leafLength > 0) {
          leafLength += n._leafLength - 1; //最初の子は親と同じy座標に位置するため-1する
        }
      });
      node._leafLength = leafLength;
    }
    if (node.parent !== null) {
      this.setLeafLength(node.parent);
    }
  }
  setNodeNameProperties(node) {
    //名前用text要素からサイズをキャッシュしておき、他要素のレイアウトの計算に使用する。
    // let nameSize = this.measureTextSize( this.getLineBreakTexts( node ) );
    let nameSize = new Util().measureTextSize(node.data.name, this.$svg);
    node._nameWidth = nameSize.width;
    node._nameHeight = nameSize.height;

    //項目名が長い（２行以上表示される）場合に省略表示を行う
    let strEachLine = this.splitStringEachLine(node.data.name);
    node._ellipsisName = strEachLine[0];
    node._isEllpsis = strEachLine.length > 1;
    if (node._isEllpsis) {
      node._ellipsisName += "...";
    }
  }
  setVerticalIndex(node) {
    let verticalIndex = 0;

    if (node.parent === undefined || node.parent === null) {
      //ルートノードの場合は一番上に表示する
      verticalIndex = 0;
    } else if (node._childIndex === 0 || !node._isShow) {
      //長男ノードの場合は親の隣に位置するため、縦方向の位置は同じ
      verticalIndex = node.parent._verticalIndex;
    } else if (node.parent.children !== null) {
      //兄弟ノードの場合は自分の兄の縦方向の１つ下の位置
      node.parent.children.map((brotherNode) => {
        if (brotherNode._childIndex === node._childIndex - 1) {
          //兄弟ノードの縦位置と葉っぱノードの数の合計
          verticalIndex =
            brotherNode._verticalIndex +
            Math.max(brotherNode._leafLength - 1, 0) +
            1;
        }
      });
    }
    node._verticalIndex = verticalIndex;
  }
  updateBackground() {
    if (this.$background === undefined) {
      this.$background = this.$svg
        .append("g")
        .attr("class", "tree-bg")
        .on("click", () => {
          this.blurNode();
        });
    }

    let $rects = this.$background.selectAll("rect");
    let currentRectCount = $rects.data().length;
    let needRectCount = Math.ceil(this.svgWidth / this.columnWidth);

    if (currentRectCount < needRectCount) {
      // 不足分の背景を加える
      for (let i = currentRectCount; i < needRectCount; i++) {
        this.$background
          .append("rect")
          .attr("data-index", i)
          .attr("width", this.columnWidth)
          .attr("height", this.svgHeight)
          .attr("x", i * this.columnWidth)
          .attr("y", 0);
      }
    } else if (currentRectCount > needRectCount) {
      // 余分がある場合は削除する
      $rects.each(function (d) {
        let $rect = d3.select(this);
        let index = $rect.attr("data-index");
        if (index >= needRectCount) {
          $rect.remove();
        }
      });
    }

    $rects
      .transition()
      .duration(DEFAULT_DURATION)
      .attr("width", this.columnWidth)
      .attr("height", this.svgHeight);
  }
  initLayout() {
    let $defs = this.$svg.append("defs");
    this.appendGradient($defs, "branchGradient");
    this.appendGradient($defs, "leafGradient");

    this.$nodeWrap = this.$svg
      .append("g")
      .attr("transform", "translate(0, " + MARGIN.CONTAINER.TOP + ")");
  }
  appendGradient($defs, gradientId) {
    let $branchGradient = $defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 1);
    let $fromColor = $branchGradient
      .append("stop")
      .attr("class", "from")
      .attr("offset", "0%");
    let $toColor = $branchGradient
      .append("stop")
      .attr("class", "to")
      .attr("offset", "100%");
  }
  showTooltip($nodeName, nodeData) {
    if (!nodeData._isEllpsis) {
      return;
    }

    let tooltipMargin = {
      left: 10,
      top: 5,
    };

    let $tooltip = this.$svgWrap.append("div").attr("class", "node-tooltip");

    let $tooltipText = $tooltip
      .append("p")
      .attr("class", "node-tooltip-text")
      .text(nodeData.data.name);

    let tooltipHeight = $tooltip.node().clientHeight;
    let tooltipTop =
      nodeData._y +
      MARGIN.CONTAINER.TOP -
      this.rowHeight / 2 -
      tooltipHeight -
      tooltipMargin.top;

    $tooltip.attr(
      "style",
      `left:${nodeData._x + tooltipMargin.left}px; top:${tooltipTop}px;`
    );
  }
  hideTooltip() {
    let $tooltip = this.$svgWrap.selectAll(".node-tooltip").remove();
  }
  updateUserInputNode(node) {
    let _this = this;
    let maxLeafCount;
    let minLeafCount;

    this.nodes.each((d) => {
      (maxLeafCount = d.data.maximum_leaf_count || -1),
        (minLeafCount = d.data.minimum_leaf_count || -1);

      if (maxLeafCount < 0 || minLeafCount < 0) {
        return true;
      }

      let inputNodeData = _this.createNodeData({
        id: this.createNodeId(),
        name: "回答者が入力",
        children: null,
      });
      // 回答者入力ノードフラグ
      inputNodeData._isUserInput = true;
      this.insertChild(d, inputNodeData, 0);
    });

    this.nodeList = this.nodes.descendants();
  }
  // ノードのドラッグ移動開始
  startDragging(target) {
    this.$dragNode = d3.select(target);
    let dragNodeData = this.$dragNode.data()[0];
    this.setPropertyForNode(dragNodeData, "_isDragging", true);
    this.focusNode(dragNodeData);
  }
  // ノードのドラッグ中処理
  doDragging() {
    let dragNodeData = this.$dragNode.data()[0];
    if (dragNodeData.depth === 0 || dragNodeData._isUserInput) {
      return;
    }

    if (!this.$svgWrap.classed("is-dragging")) {
      this.appendDragLayer();
    }
    if (this.$dummyNode) {
      this.$dummyNode.attr(
        "transform",
        `translate(${d3.event.x}, ${d3.event.y})`
      );
    } else {
      this.createDummyNode();
    }
  }
  createDummyNode() {
    this.$dummyNode = new Util()
      .copySelection(this.$dragNode, this.$nodeWrap)
      .attr("class", "node--drag")
      .attr("opacity", "0.5")
      // dragAreaのmouseoverを検知できるようにdummyNodeのマウスイベントを無効化
      .attr("pointer-events", "none");

    this.$dummyNode.attr(
      "data-init-transform",
      this.$dummyNode.attr("transform")
    );
  }
  appendDragLayer() {
    let _this = this;
    let dragNodeData = this.$dragNode.data()[0];

    let overDragArea = function (d) {
      d3.select(this).classed("is-selected", true);
    };
    let outDragArea = function (d) {
      d3.select(this).classed("is-selected", false);
    };
    let setDragAreaProperties = function ($dragArea) {
      $dragArea
        .attr("class", "tree-dragarea")
        .classed("is-disabled", function (d) {
          // ノードは兄弟ノード間のみ移動できるようにする
          let $target = d3.select(this);
          let layoutIndex = parseInt($target.attr("data-childindex"));
          let isBrothers = d.parent === dragNodeData.parent;
          let isYoungBrother =
            isBrothers && dragNodeData._childIndex === layoutIndex - 1;
          let isSamePosition = isYoungBrother || d._isDragging;
          // let isDisabled = !isBrothers || isSamePosition || d._isUserInput;
          let isDisabled = isSamePosition || d._isUserInput;

          return isDisabled;
        })
        .attr("width", _this.columnWidth)
        .attr("data-depth", (d) => {
          return d.depth;
        })
        .attr("data-parentid", (d) => {
          return d.parent ? d.parent.data.id : -1;
        })
        .on("mouseover", overDragArea)
        .on("mouseout", outDragArea);
    };
    let appendChildren = function ($dragArea, isLast) {
      $dragArea
        .append("rect")
        .attr("width", _this.columnWidth)
        .attr("height", (d) => {
          return getLayerHeight(d, isLast);
        });
      $dragArea
        .append("line")
        .attr("x1", 0)
        .attr("y1", (d) => {
          return getLineY(d, isLast);
        })
        .attr("x2", $dragArea.attr("width"))
        .attr("y2", (d) => {
          return getLineY(d, isLast);
        });
    };
    let getLayerHeight = function (d, isLast) {
      let dragAreaHeight = 0;
      let isFirst = d._childIndex === 0;
      let isTop = d._verticalIndex === 0;

      if (isFirst) {
        dragAreaHeight = _this.rowHeight / 2;
        // if( !isTop ) {
        //   // ノードより上をドラッグ可能領域とする
        //   dragAreaHeight += _this.svgHeight - ( _this.svgHeight - d._y );
        // }
      } else if (isLast) {
        // ノードより下の領域をドラック可能領域とする
        dragAreaHeight = _this.svgHeight - d._y - _this.rowHeight / 2;
      } else {
        // ノード間をドラッグ可能領域とする
        let brotherNode = _this.getChildren(d.parent)[d._childIndex - 1];
        dragAreaHeight = d._y - brotherNode._y;
      }
      return dragAreaHeight;
    };
    let getLineY = function (d, isLast) {
      let isFirst = d._childIndex === 0;
      let lineY = 0;

      if (isFirst && isLast) {
        lineY = _this.rowHeight / 2;
      } else if (isFirst) {
        // lineY = d._y;
        lineY = 0;
      } else if (isLast) {
        lineY = _this.rowHeight / 2;
      } else {
        lineY = getLayerHeight(d, isLast) - _this.rowHeight / 2;
      }
      return lineY;
    };

    let $dragArea = this.$nodeWrap
      .selectAll(".node")
      .append("g")
      .classed("is-first", (d) => {
        return d._childIndex === 0;
      })
      .attr("transform", (d) => {
        return `translate(0, ${-getLayerHeight(d)})`;
      })
      .attr("data-childindex", (d) => {
        return d._childIndex;
      })
      .call(setDragAreaProperties)
      .call(($dragArea) => {
        appendChildren($dragArea, false);
      });

    let $lastdragArea = this.$nodeWrap
      .selectAll(".node--youngest")
      .append("g")
      .classed("is-last", true)
      .attr("transform", "translate(0,0)")
      .attr("data-childindex", (d) => {
        return d._childIndex + 1;
      })
      .call(setDragAreaProperties)
      .call(($dragArea) => {
        appendChildren($dragArea, true);
      });

    $dragArea = this.$nodeWrap.selectAll(".tree-dragarea");
    this.$svgWrap.classed("is-dragging", true);
  }
  // ノードのドラッグ移動終了
  endDragging() {
    let $selectedDragArea = d3.select(".tree-dragarea.is-selected");
    let exitFunc = () => {
      if (!this.$dragNode) {
        return;
      }
      let dragNodeData = this.$dragNode.data()[0];

      this.$nodeWrap.selectAll(".tree-dragarea").remove();
      this.$svgWrap.classed("is-dragging", false);
      this.setPropertyForNode(dragNodeData, "_isDragging", false);

      this.$dummyNode = null;
      this.$svg.selectAll(".node--drag").remove();
      this.$dragNode = null;
    };

    if (this.$dummyNode === undefined || this.$dummyNode === null) {
      exitFunc();
      return;
    }

    if ($selectedDragArea.data().length > 0) {
      let moveNode = this.$dragNode.data()[0];
      let toParentId = parseInt($selectedDragArea.attr("data-parentid"));
      let toChildIndex = parseInt($selectedDragArea.attr("data-childindex"));
      let toDepth = parseInt($selectedDragArea.attr("data-depth"));
      let isMovedNode = this.isMovedNode(
        moveNode,
        toParentId,
        toChildIndex,
        toDepth
      );

      if (isMovedNode) {
        // ノードの移動を実行して処理を終了する
        this.updateNode({
          type: NODE_METHOD.MOVE_NODE,
          data: {
            moveNode: this.$dragNode.data()[0],
            toParentId: toParentId,
            toChildIndex: toChildIndex,
            toDepth: toDepth,
          },
        });
        exitFunc();
        return;
      }
    }
    // 移動しない場合はダミーノードを元の位置に戻し、削除する
    this.$dummyNode
      .transition()
      .duration(DEFAULT_DURATION)
      .attr("transform", this.$dummyNode.attr("data-init-transform"))
      .on("end", () => {
        exitFunc();
      });
  }
  // 項目名の改行を行なった結果をHTML要素に変換して返す
  getLineBreakTexts(node) {
    let lineHeight = 1.5;
    let textHtml = "";
    let strEachLine = this.splitStringEachLine(node.data.name);

    strEachLine.forEach((text, index) => {
      textHtml +=
        '<tspan class="line line' +
        index +
        '" x="0" y="' +
        index * lineHeight +
        'em" dx="0.6em" dy="0.35em">' +
        text +
        "</tspan>";
    });
    return textHtml;
  }
  // ノード名複数行対応：行ごとの文字列に分割した配列を作成する
  splitStringEachLine(str) {
    let strEachLine = [];
    let lineCount = 0;
    let strLength;

    for (let i = 0, len = str.length; i < len; i++) {
      let chara = str[i];
      if (strEachLine.length <= lineCount) {
        strEachLine.push("");
      }
      strEachLine[lineCount] += chara;

      // 1行内の文字数が一定数より多い場合は改行の可能性がある（一定数＝全角文字で１行に必ず入る文字数）
      let isPossibilityLineBreak =
        strEachLine[lineCount].length > this.textMinLength;
      if (isPossibilityLineBreak) {
        // 文字幅が１行に表示できる文字を超えている場合は改行
        let strSize = new Util().measureTextSize(
          strEachLine[lineCount],
          this.$svg
        );
        if (strSize.width >= this.textLineWidth) {
          ++lineCount;
        }
      }
    }
    return strEachLine;
  }
  initNode() {
    this.$nodes = this.createNode(this.nodeList);
    this.updateParentNode();
  }
  updateParentNode() {
    this.updateLineToChild();
    this.updateToggleChildren();
  }
  // 親ノードが子を持っているか確認する
  hasChildren(node) {
    let children = this.getChildren(node);
    return children && children.length > 0;
  }
  // 親ノードの子を取得する
  getChildren(node) {
    return node.children;
  }
  // 親ノードの子に指定されたノードを挿入する
  insertChild(parentNode, insertNode, childIndex) {
    if (this.hasChildren(parentNode)) {
      let children = this.getChildren(parentNode);

      if (childIndex === undefined || children.length <= childIndex) {
        children.push(insertNode);
        parentNode.data.children.push(insertNode.data);
      } else {
        children.splice(childIndex, 0, insertNode);
        parentNode.data.children.splice(childIndex, 0, insertNode.data);
      }
    } else {
      parentNode.children = [insertNode];
      parentNode.data.children = [insertNode];
    }
    insertNode.parent = parentNode;
    this.setPropertyForNode(
      insertNode,
      "depth",
      parentNode.depth + 1,
      (val) => {
        return val + 1;
      }
    );
  }
  /*
  ノードの子孫も含めて任意のプロパティを更新する
  @param node (Object) 更新の対象となるノードデータ
  @param propertyName (String) プロパティ名
  @param value (anything) 値
  @param recursive (function) 子孫へ再起的に実行する際にvalueに対して何かしら処理を行う際に使用する
  */
  setPropertyForNode(node, propertyName, value, recursive) {
    node[propertyName] = value;

    if (!this.hasChildren(node)) {
      return;
    }
    let children = this.getChildren(node);

    if (typeof recursive === "function") {
      value = recursive(value);
    }

    for (let i = 0, len = children.length; i < len; i++) {
      this.setPropertyForNode(children[i], propertyName, value, recursive);
    }
  }
  /*
  ノード作成・更新時に共通のプロパティを設定する処理
  */
  setCommonPropetiesForNode($nodes) {
    $nodes
      .classed("node--oldest", (d) => {
        return d._childIndex === 0;
      })
      .classed("node--youngest", (d) => {
        return (
          d.parent && d._childIndex === this.getChildren(d.parent).length - 1
        );
      })
      .classed("node--branch", (d) => {
        let children = [];
        // let leafs = [];

        if (this.hasChildren(d)) {
          children = this.getChildren(d);
          // leafs = children.filter((d) => {
          //   return !this.hasChildren(d);
          // });
        }
        return children.length > 0;
      })
      .classed("node--leaf", (d) => {
        return !this.hasChildren(d);
      })
      .classed("node--other", (d) => {
        // 子は存在するが、葉を１つも持っていないノード
        let hasChildren = this.getChildren(d);
        let hasLeaf = false;
        if (this.hasChildren(d)) {
          this.getChildren(d).map((d) => {
            if (!this.hasChildren(d)) {
              hasLeaf = true;
              return false;
            }
          });
        }
        return hasChildren && !hasLeaf;
      })
      .classed("node--userinput", (d) => {
        return d._isUserInput;
      })
      .classed("is-close", false);
  }
  // ノードを追加する際に新しいIDを作成する
  createNodeId() {
    let maxId = d3.max(this.nodes.descendants(), (d) => {
      return d.data.id;
    });
    return ++maxId;
  }
  // ノード作成処理
  createNode(dataSet) {
    let _this = this;

    let $nodes = this.$nodeWrap
      .selectAll(".node")
      .data(dataSet, (d) => {
        return d.data.id;
      })
      .enter()
      .append("g")
      .attr("class", (d) => {
        return "node";
      })
      .call(this.setCommonPropetiesForNode.bind(this))
      .attr("width", this.columnWidth)
      .attr("height", this.nodeHeight)
      .attr("opacity", 1)
      .attr("transform", function (d) {
        return "translate(" + d._x + ", " + d._y + ")";
      });

    //背景に敷くためのrect要素を先に要素追加しておき、後でプロパティを設定する
    let $nodesBg = $nodes.append("rect");

    //ノード名の左側に表示するアイコン
    // let $nodeHead = $nodes.append('circle')
    //   .attr('r', 3);

    //ノード名用text要素
    let $nodeText = $nodes
      .append("text")
      .attr("class", "node-name")
      .attr("x", MARGIN.NODE_NAME.LEFT)
      .attr("y", "0.35em")
      .text((d) => {
        return d._ellipsisName ? d._ellipsisName : d.data.name;
      });

    // 親ノードと子ノードを繋ぐためのパス
    let $nodePath = $nodes
      .append("path")
      .attr("class", "node-path")
      .attr("d", this.calculateNodePathD)
      .attr("fill", "none");

    //背景用rect要素のプロパティを設定
    //ノードドラッグ時に発生させたくないイベントはこのSelectionにバインドする
    $nodesBg
      .attr("height", (d) => {
        return d._nameHeight;
      })
      .attr("class", "node-bg")
      .attr("width", this.columnWidth - MARGIN.NODE.LEFT)
      .attr("height", this.nodeHeight)
      .attr("x", MARGIN.NODE.LEFT)
      .attr("y", -(this.nodeHeight / 2))
      .attr("fill", "transparent")
      .on("mouseover", function (d) {
        if (_this.$svgWrap.classed("is-dragging")) {
          return;
        }
        _this.showTooltip(d3.select(this), d);
      })
      .on("mouseout", (d) => {
        this.hideTooltip();
      })
      .on("click", (d) => {
        _this.focusNode(d);
      })
      .on("dblclick", (d) => {
        if (this.editable) {
          _this.editStartNodeName(d);
        }
      });

    if (this.draggable) {
      $nodes.each(function (d) {
        //ドラッグ＆ドロップで移動可能にする
        d3.select(this).call(
          d3
            .drag()
            .on("start", function () {
              _this.startDragging(this);
            })
            .on("drag", () => {
              _this.doDragging();
            })
            .on("end", () => {
              _this.endDragging();
            })
        );
      });
    }
    return $nodes;
  }
  // ノード更新処理
  updateNode(param) {
    var _this = this;

    if (param) {
      switch (param.type) {
        case NODE_METHOD.UPDATE_NAME:
          // 指定されたパラメータを元に内部データを更新する
          this.nodeList.map((node) => {
            if (param.data.id !== node.data.id) return true;
            for (let key in param.data) {
              node.data[key] = param.data[key];
            }
            this.setNodeNameProperties(node);
          });
          break;
        case NODE_METHOD.TOGGLE_CHILDREN:
          const node = param.data.node;
          if (node._isToggleOpen === undefined) {
            node._isToggleOpen = false;
          } else {
            node._isToggleOpen = !node._isToggleOpen;
          }
          this.updateNodesLayout();
          break;
        case NODE_METHOD.DELETE_NODE:
          //ルートノードは削除できない
          if (param.data.deleteNode.depth === 0) {
            return;
          }

          // 対象ノードをデータから削除し、各ノードの位置を再計算する。
          this.deleteNodeData(param.data.deleteNode, param.confirm);
          this.nodeList = this.nodes.descendants();
          this.updateNodesLayout();
          break;
        case NODE_METHOD.APPEND_NODE_TEMP:
          this.nodeList = this.nodes.descendants();
          this.updateNodesLayout();
          break;
        case NODE_METHOD.MOVE_NODE:
          let { data } = param;
          let { moveNode, toParentId, toChildIndex, toDepth } = data;
          let isSameParent =
            moveNode.parent && moveNode.parent.data.id === toParentId;
          let isYounger = moveNode._childIndex < toChildIndex;

          if (isSameParent && isYounger) {
            --toChildIndex;
          }

          if (!this.isMovedNode(moveNode, toParentId, toChildIndex, toDepth)) {
            return;
          }

          //ノードリストから対象のノードを取り除く
          this.deleteNodeData(moveNode);

          //対象ノードを移動先の位置に加える
          this.nodes.each((d) => {
            if (d.data.id !== toParentId) {
              return true;
            }
            this.insertChild(d, moveNode, toChildIndex);
            return false;
          });

          this.nodeList = this.nodes.descendants();
          this.updateNodesLayout();
          break;
      }
    }

    let $newNode = this.createNode(this.nodeList);

    // 内部データを元に各ノードの状態を更新する
    this.$nodes = this.$nodeWrap
      .selectAll(".node")
      .data(this.nodeList, (d) => {
        // idをもとに変更前と変更後のノード情報を紐づける
        return d.data.id;
      })
      .call(this.setCommonPropetiesForNode.bind(this))
      .transition()
      .on("end", function (d) {
        // アニメーションが終わった後にノードを非表示にする
        if (!d._isShow) {
          d3.select(this).classed("is-close", true);
        }
      })
      .duration(DEFAULT_DURATION)
      .attr("opacity", (d) => {
        return d._isShow ? 1 : 0;
      })
      .attr("transform", (d) => {
        return `translate(${d._x}, ${d._y})`;
      });

    let $delNodes = this.$nodeWrap
      .selectAll(".node")
      .data(this.nodeList, (d) => {
        return d.data.id;
      })
      .exit()
      .remove();

    let $texts = this.$nodes.selectAll(".node-name").text((d) => {
      return d._ellipsisName ? d._ellipsisName : d.data.name;
    });

    this.$nodeWrap
      .selectAll(".node-path")
      .transition()
      .duration(DEFAULT_DURATION)
      .attr("d", this.calculateNodePathD);

    if (
      $newNode !== undefined &&
      $newNode !== null &&
      $newNode.data().length > 0
    ) {
      //内部データを更新した後、追加されたノードは編集状態にする
      let newNodeData = $newNode.data()[0];
      this.editStartNodeName(newNodeData);
      this.focusNode(newNodeData);
    }

    this.updateParentNode();
  }
  focusNode(selectNodes) {
    let selectIds = [];

    if (Array.isArray(selectNodes)) {
      selectNodes.map((d) => {
        selectIds.push(d.data.id);
      });
    } else {
      selectIds.push(selectNodes.data.id);
    }

    this.$nodes.each(function (d) {
      let $node = d3.select(this);
      let isSelected = selectIds.indexOf(d.data.id) > -1;
      $node.classed("is-selected", isSelected);
    });
  }
  blurNode() {
    this.$nodes.each(function (d) {
      d3.select(this).classed("is-selected", false);
    });
  }
  moveSelectNode(move_direction) {
    let selectedNodes = this.getSelectedNodes();
    if (selectedNodes === null || selectedNodes.length === 0) {
      return;
    }
    let selectedNode = selectedNodes[0];
    let { _childIndex, depth } = selectedNode;
    let newSelectNodes;
    let cousinNodes;

    switch (move_direction) {
      case MOVE_DIRECTION.TOP:
        cousinNodes = this.nodeList.filter((d) => {
          return (
            selectedNode.depth === d.depth &&
            selectedNode._verticalIndex > d._verticalIndex
          );
        });
        newSelectNodes =
          cousinNodes.length > 0
            ? cousinNodes[cousinNodes.length - 1]
            : undefined;
        break;
      case MOVE_DIRECTION.LEFT:
        newSelectNodes = selectedNode.parent
          ? [selectedNode.parent]
          : undefined;
        break;
      case MOVE_DIRECTION.BOTTOM:
        cousinNodes = this.nodeList.filter((d) => {
          return (
            selectedNode.depth === d.depth &&
            selectedNode._verticalIndex < d._verticalIndex
          );
        });
        newSelectNodes = cousinNodes.length > 0 ? cousinNodes[0] : undefined;
        break;
      case MOVE_DIRECTION.RIGHT:
        newSelectNodes = this.nodeList.filter((d) => {
          return (
            selectedNode === d.parent &&
            d._childIndex === 0 &&
            d.depth === depth + 1
          );
        });
        break;
    }

    if (newSelectNodes === undefined || newSelectNodes.length === 0) {
      return;
    }

    this.focusNode(newSelectNodes);
  }
  getSelectedNodes() {
    let selectedNodes = this.$nodeWrap.select(".node.is-selected").data();
    if (selectedNodes === undefined && selectedData.length === 0) {
      return null;
    }
    return selectedNodes;
  }
  deleteSelectedNode() {
    let selectedNodes = this.getSelectedNodes();

    for (let i = 0, len = selectedNodes.length; i < len; i++) {
      this.deleteNode(selectedNodes[i]);
    }
  }
  // ツリーに表示されているノードを削除する
  deleteNode(node) {
    //編集中には削除処理を実行しない
    if (node._isEdit) {
      return;
    }

    this.updateNode({
      type: NODE_METHOD.DELETE_NODE,
      data: {
        deleteNode: node,
      },
      confirm: (deleteNode) => {
        // 確認処理を行い、キャンセルした場合は処理を中断する。
        let hasChildren =
          this.getChildren(deleteNode) &&
          this.getChildren(deleteNode).length > 0;
        let doDelete = true;

        if (hasChildren) {
          doDelete = confirm(
            "子階層のノードも削除されますが、本当に削除してもよろしいですか？"
          );
        }
        return doDelete;
      },
    });
  }
  // 内部ノード情報から対象のノードを削除する
  deleteNodeData(node, confirmFunction) {
    let deleteNode = null;
    let parentNode = null;

    this.nodes.each((d) => {
      if (node === d) {
        deleteNode = d;
        parentNode = d.parent;
        return false;
      }
    });

    // 確認処理を行い、キャンセルした場合は処理を中断する。
    let doConfirm = confirmFunction && typeof confirmFunction === "function";
    if (doConfirm && !confirmFunction(deleteNode)) {
      return;
    }

    parentNode.children.map((d, i) => {
      if (d !== deleteNode) {
        return true;
      }
      parentNode.children.splice(i, 1);
    });
  }
  editStartNodeName(node) {
    let _this = this;
    let $node;

    if (node._isUserInput) {
      return;
    }

    this.$nodes.each(function (d) {
      if (d.data.id === node.data.id) {
        $node = d3.select(this);
        return false;
      }
    });

    node._isEdit = true;
    $node.classed("is-editing", true);

    //テキストボックスを生成し、編集状態にする
    let $inputNode = this.$svgWrap
      .append("input")
      .attr("type", "text")
      .attr("value", node.data.name)
      .attr("class", "node-textbox")
      .attr(
        "style",
        `left:${node._x + MARGIN.NODE.LEFT}px; top:${
          node._y + MARGIN.CONTAINER.TOP - this.nodeHeight / 2
        }px; width:${this.columnWidth - MARGIN.NODE.LEFT}px; height:${
          this.nodeHeight
        }px;`
      )
      .on("blur", function () {
        let isEmpty = this.value.trim() === "";
        let newNodeName = d3.select(this).node().value;

        //テキストボックスからフォーカスが外れた場合は元のラベルを更新する
        node._isEdit = false;
        $node.classed("is-editing", false);
        _this.$svgWrap.selectAll(".node-textbox").remove();

        if (isEmpty) {
          if (node._isTemp) {
            //ノード追加時の場合は追加前の状態に戻す
            _this.deleteNode(node);
            return;
          } else {
            //空文字の場合は元の名前に戻す
            newNodeName = node.data.name;
          }
        }

        _this.updateNode({
          type: NODE_METHOD.UPDATE_NAME,
          data: {
            id: node.data.id,
            name: newNodeName,
          },
        });
      });

    $inputNode.node().focus();
  }
  editEndNodeName() {
    let $inputNode = this.$svgWrap.selectAll(".node-textbox");
    if ($inputNode.data().length === 0) {
      return;
    }
    $inputNode.node().blur();

    this.updateLineToChild();
  }
  isMovedNode(moveNode, toParentId, toChildIndex, toDepth) {
    let someParent = moveNode.parent && moveNode.parent.data.id === toParentId;
    let someChildIndex = moveNode._childIndex === toChildIndex;
    let someDepth = moveNode.depth === toDepth;
    return !(someParent && someChildIndex && someDepth);
  }
  isNodeNameEmpty() {
    let isEmpty = true;
    let $inputNode = this.$svgWrap.selectAll(".node-textbox");
    if ($inputNode.data().length === 0) {
      return isEmpty;
    }
    isEmpty = $inputNode.node().value.trim() === "";
    return isEmpty;
  }
  appendTempNode(selectedNode, direction) {
    if (!this.addable) {
      return;
    } else if (selectedNode._isEdit) {
      if (!this.isNodeNameEmpty()) {
        this.editEndNodeName();
      }
      return;
    } else if (
      selectedNode._isUserInput &&
      direction === APPEND_DIRECTION.RIGHT
    ) {
      return;
    }

    let parentNode = selectedNode.parent;
    if (parentNode === null && direction === APPEND_DIRECTION.BOTTOM) {
      //ルート階層の下にノードは追加できないようにする
      return;
    }

    // ノード追加を行うための一時ノードを生成してツリーに加える
    let tempNodeData = this.createNodeData({
      id: this.createNodeId(),
      name: "",
      children: null,
      _isTemp: true,
    });

    switch (direction) {
      case APPEND_DIRECTION.RIGHT:
        this.insertChild(selectedNode, tempNodeData);
        break;
      case APPEND_DIRECTION.BOTTOM:
        this.insertChild(
          parentNode,
          tempNodeData,
          selectedNode._childIndex + 1
        );
        break;
    }

    this.updateNode({
      type: NODE_METHOD.APPEND_NODE_TEMP,
    });
  }
  updateToggleChildren() {
    let _this = this;
    let circleRadius = 8;

    this.$nodes.each(function (d) {
      let $node = d3.select(this);
      let isParent = _this.hasChildren(d);
      let hasToggle = $node.select(".node-toggle").node() !== null;

      if (isParent && !hasToggle) {
        let $toggle = $node
          .append("g")
          .attr("class", "node-toggle")
          .attr(
            "transform",
            `translate(${_this.columnWidth - circleRadius * 2}, 0)`
          )
          .on("click", (d) => {
            _this.toggleChildren(d);
          });

        let $circles = $toggle.append("circle").attr("r", circleRadius);

        let $texts = $toggle
          .append("text")
          .attr("class", "node-toggle-label")
          .attr("width", circleRadius * 2)
          .attr("hegith", circleRadius * 2)
          .attr("text-anchor", "middle")
          .attr("dy", circleRadius / 2)
          .text(d._isToggleOpen === false ? "+" : "–");
      } else if (isParent && hasToggle) {
        $node
          .select(".node-toggle-label")
          .text(d._isToggleOpen === false ? "+" : "–");
      } else if (!isParent && hasToggle) {
        $node.select(".node-toggle").remove();
      }
    });
  }
  updateLineToChild() {
    let _this = this;

    this.$svgWrap.selectAll(".node-branch-line").remove();
    this.$svgWrap.selectAll(".node--other").each(function (d) {
      let $node = d3.select(this);
      let isParent = _this.hasChildren(d);
      let hasLine = $node.select(".node-branch-line").node() !== null;

      // if( isParent && !hasLine && !d._isEllpsis ) {
      //   $node.append('line')
      //     .attr('class', 'node-branch-line')
      //     .attr('stroke', 'black')
      //     .attr('stroke-width', 1)
      //     .attr('stroke-dasharray', '1 4')
      //     .attr('x1', d._nameWidth + MARGIN.NODE_NAME.LEFT + 10)
      //     .attr('y1', 0)
      //     .attr('x2', _this.columnWidth - 10)
      //     .attr('y2', 0);
      // }
    });
  }
  toggleChildren(parentData) {
    this.updateNode({
      type: NODE_METHOD.TOGGLE_CHILDREN,
      data: {
        node: parentData,
      },
    });
  }
}

class Util {
  measureTextSize(str, $container) {
    let $text = $container
      .append("text")
      .attr("class", "temp-measure-text")
      .html(str);
    let bbox = $text.node().getBBox();
    $text.remove();
    return bbox;
  }
  copySelection($target, $to) {
    let node = $target.node();
    let { nodeName, attributes, children } = node;
    let $copy = $to.append(nodeName);

    Object.keys(attributes).forEach((key) => {
      $copy.attr(attributes[key].name, attributes[key].value);
    });
    $copy.html($target.html());

    return $copy;
  }
}

(function () {
  window.TreeUI = TreeUI;
})();
