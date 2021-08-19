import { Component, createElement } from 'react';
import * as React from 'react';
import * as go from 'gojs';
import { ReactDiagram } from 'gojs-react';
import pptxgen from "pptxgenjs";
import { encode } from 'base-64';
import "./ui/OrgCharts.css";

export default class OrgChart extends Component {
  constructor(props) {
    super(props);
    this.initDiagram = this.initDiagram.bind(this);
    this.makePPT = this.makePPT.bind(this);
    this.chartDataWrapper = { chartDataList: [] };
  }
  // ...
  /**
   * Diagram initialization method, which is passed to the ReactDiagram component.
   * This method is responsible for making the diagram and initializing the model and any templates.
   * The model's data should not be set here, as the ReactDiagram component handles that via the other props.
   */
  initDiagram() {
    const $ = go.GraphObject.make;
    // set your license key here before creating the diagram: go.Diagram.licenseKey = "...";
    // const licensekey = this.props.licenseKey;
    // go.Diagram.licenseKey = licensekey;

    const diagram =
      $(go.Diagram,
        {
          'undoManager.isEnabled': true,  // must be set to allow for model change listening
          layout:
            $(go.TreeLayout,
              {
                treeStyle: go.TreeLayout.StyleLastParents,
                arrangement: go.TreeLayout.ArrangementHorizontal,
                // properties for most of the tree:
                angle: 90,
                layerSpacing: 35,
                // properties for the "last parents":
                alternateAngle: 90,
                alternateLayerSpacing: 35,
                alternateAlignment: go.TreeLayout.AlignmentBus,
                alternateNodeSpacing: 20
              }),
          model: $(go.GraphLinksModel,
            {
              linkKeyProperty: 'key'  // IMPORTANT! must be defined for merges and data sync when using GraphLinksModel
            })
        });
    // define a simple Node template
    diagram.nodeTemplate =
      $(go.Node, 'Vertical',  // the Shape will go around the TextBlock
        { background: "#7396aa" },
        new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
        //    $(go.Shape, 'RoundedRectangle',
        //      { name: 'SHAPE', fill: 'white', strokeWidth: 0 },
        //      // Shape.fill is bound to Node.data.color
        //      new go.Binding('fill', 'color')),
        $(go.TextBlock,
          { stroke: "white", margin: 8, editable: false, },  // some room around the text
          new go.Binding('text', "code").makeTwoWay()
        ),
        $(go.TextBlock,
          { stroke: "white", margin: 8, editable: false, },  // some room around the text
          new go.Binding('text', "name").makeTwoWay()
        ),
        $("TreeExpanderButton",
          { alignment: go.Spot.Bottom, alignmentFocus: go.Spot.Top },
          { visible: true })
      );
    diagram.linkTemplate =
      $(go.Link,
        { routing: go.Link.Orthogonal, corner: 5 },
        $(go.Shape, // the link's path shape
          { strokeWidth: 3, stroke: "#555" })
      );
    // diagram.model = new go.GraphLinksModel(
      // [
      //   { code: "Alpha"  },
      //   { code: "Beta" },
      //   { code: "Gamma" },
      //   { code: "Delta" }
      // ],
      // [
      //   { from: "Alpha", to: "Beta" },
      //   { from: "Alpha", to: "Gamma" },
      //   { from: "Beta", to: "Beta" },
      //   { from: "Gamma", to: "Delta" },
      //   { from: "Delta", to: "Alpha" }
      // ]);
    return diagram;
  }

  makePPT() {
    let pptx = new pptxgen();
    this.chartDataWrapper.chartDataList.filter(chartData => chartData.errors.length === 0).forEach(chartData => {
      const diagram = chartData.diagramRef.current.getDiagram();
      if (diagram instanceof go.Diagram) {
        var svg = diagram.makeSvg({ scale: 1, background: "white" });
        const svgstr = new XMLSerializer().serializeToString(svg);
        const image = encode(svgstr);
        let slide = pptx.addSlide();
        slide.addText(chartData.header, { y: '5%', w: '100%', align: 'center' });
        slide.addImage({ data: "data:image/svg+xml;base64," + image, x: '15%', y: '15%', w: '70%', h: '70%', type: 'contain' })
      }
    });
    pptx.writeFile({ fileName: "OrgUnitList.pptx" });
  }

  createDiagramData() {
    if (this.props.chartEntityList.status === 'available') {
      const itemList = this.props.chartEntityList.items;
      itemList.forEach(element => {
        let nodeValueString = this.props.nodedataChartEntity(element).value;
        let linkValueString = '';
        if (this.props.linkdataChartEntity) {
          linkValueString = this.props.linkdataChartEntity(element).value;
        }
        let header = null;
        if (this.props.header) {
          header = this.props.header(element).value;
        }
        let nodeValueJSON = [];
        let linkValueJSON = [];
        let errors = [];
        if (nodeValueString != '') {
          try {
            nodeValueJSON = JSON.parse(nodeValueString);
          } catch (err) {
            errors.push("Error in parsing NodeData JSON: " + err);
            console.error(err);
          }
        }
        if (linkValueString != '') {
          try {
            linkValueJSON = JSON.parse(linkValueString);
          } catch (err) {
            errors.push("Error in parsing LinkData JSON: " + err);
            console.error(err);
          }
        }
        const diagramRef = React.createRef();
        this.chartDataWrapper.chartDataList.push({ nodeValueJSON, linkValueJSON, header, diagramRef, errors });
      });
    }
  }

  render() {
    this.chartDataWrapper = { chartDataList: [] };
    this.createDiagramData();

    return (
      <div className="diagramWrapper">
        <button className="btn mx-button btn-default" onClick={this.makePPT}>Download diagrams</button>
        {
          this.chartDataWrapper.chartDataList.map(chartData => {
            return (
              <div>
                {
                  chartData.errors.map(err => {
                    return (
                      <div className="error">{err}</div>
                    );
                  })
                }
                {chartData.errors.length === 0 ?
                  <div className={this.props.showDiagrams ? '' : 'hidden'}>
                    <h3 className="diagramHeader">{chartData.header}</h3>
                    <ReactDiagram
                      initDiagram={this.initDiagram}
                      nodeDataArray={chartData.nodeValueJSON}
                      linkDataArray={chartData.linkValueJSON}
                      divClassName='diagram-component'
                      ref={chartData.diagramRef}
                    />
                  </div> : null
                }
              </div>
            )
          })
        }
      </div>
    );
  }

}