namespace Jev {
  export interface GraphViewport { zoom:number; panX:number; panY:number }
  export function graphBounds(flow:FlowDefinition):{x:number;y:number;width:number;height:number} {
    const xs=flow.nodes.map(n=>n.x),ys=flow.nodes.map(n=>n.y);
    return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs)+236,height:Math.max(...ys)-Math.min(...ys)+128};
  }
  export function graphEdgePath(edge:FlowEdge,flow:FlowDefinition):string {
    const a=flow.nodes.find(n=>n.id===edge.source),b=flow.nodes.find(n=>n.id===edge.target);if(!a||!b)return '';
    const dx=b.x-a.x,dy=b.y-a.y;
    if(Math.abs(dy)>Math.abs(dx)){
      const sign=dy>=0?1:-1,x1=a.x+118,y1=a.y+(sign>0?128:0),x2=b.x+118,y2=b.y+(sign>0?0:128),bend=Math.max(60,Math.abs(y2-y1)/2);
      return `M ${x1} ${y1} C ${x1} ${y1+sign*bend}, ${x2} ${y2-sign*bend}, ${x2} ${y2}`;
    }
    const sign=dx>=0?1:-1,x1=a.x+(sign>0?236:0),y1=a.y+64,x2=b.x+(sign>0?0:236),y2=b.y+64,bend=Math.max(70,Math.abs(x2-x1)/2);
    // Reciprocal edges take opposite lanes so loop direction remains readable.
    const reciprocal=flow.edges.some(e=>e.source===edge.target&&e.target===edge.source);
    const lane=reciprocal?(sign>0?-48:48):0;
    return `M ${x1} ${y1} C ${x1+sign*bend} ${y1+lane}, ${x2-sign*bend} ${y2+lane}, ${x2} ${y2}`;
  }
  export function graphEdgeLabel(edge:FlowEdge,flow:FlowDefinition):{x:number;y:number} {
    const a=flow.nodes.find(n=>n.id===edge.source),b=flow.nodes.find(n=>n.id===edge.target);
    if(!a||!b)return {x:0,y:0};
    return {x:(a.x+b.x)/2+118,y:(a.y+b.y)/2+48+(a.x>b.x?30:0)};
  }
}
