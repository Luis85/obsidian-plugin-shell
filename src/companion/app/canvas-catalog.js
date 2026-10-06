const CANVAS_LIMITS={world:50000,pan:200000,minZoom:.12,maxZoom:2};
const MAP_LAYOUTS={vertical:'Hierarchy · top down',horizontal:'Hierarchy · left to right',lanes:'Surface lanes',grid:'Compact grid',free:'Freeform',sections:'Sections'};
const MAP_SIZE={w:244,h:216,gapX:92,gapY:96};
const canvasUi={owner:null,selected:null,search:'',edge:null,connecting:null,outline:false,inspector:'details',expanded:false,drag:null,suppressClick:false,liveTimer:null,metrics:{moves:0,frames:0}};
