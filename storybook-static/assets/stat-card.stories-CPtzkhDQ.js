import{j as e}from"./iframe-DCrcDkvy.js";import{D as f}from"./card-DKqYyzPM.js";import"./preload-helper-Dp1pzeXC.js";function r({label:v,value:x,color:y,icon:t}){return e.jsx(f,{padding:"sm",hover:!1,style:{padding:"14px 16px"},children:e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10},children:[t&&e.jsx("span",{style:{fontSize:20},children:t}),e.jsxs("div",{children:[e.jsx("p",{style:{fontSize:11,fontWeight:600,color:"var(--color-text-secondary)",margin:"0 0 2px"},children:v}),e.jsx("p",{style:{fontFamily:"var(--font-heading)",fontSize:22,fontWeight:700,color:y||"var(--color-text)",margin:0},children:x})]})]})})}r.__docgenInfo={description:"",methods:[],displayName:"StatCard",props:{label:{required:!0,tsType:{name:"string"},description:""},value:{required:!0,tsType:{name:"string"},description:""},color:{required:!1,tsType:{name:"string"},description:""},icon:{required:!1,tsType:{name:"string"},description:""}}};const S={title:"Composite/StatCard",component:r,tags:["autodocs"]},a={args:{label:"Tareas hoy",value:"3",color:"#4F46E5"}},s={args:{label:"Gastos mes",value:"€234",color:"#10B981",icon:"💰"}},o={render:()=>e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:12},children:[e.jsx(r,{label:"Tareas hoy",value:"3",color:"#4F46E5"}),e.jsx(r,{label:"Ideas activas",value:"8",color:"#F59E0B"}),e.jsx(r,{label:"Gastos mes",value:"€234",color:"#10B981"}),e.jsx(r,{label:"Miembros",value:"5",color:"var(--color-brand)"})]})};var l,n,i;a.parameters={...a.parameters,docs:{...(l=a.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    label: 'Tareas hoy',
    value: '3',
    color: '#4F46E5'
  }
}`,...(i=(n=a.parameters)==null?void 0:n.docs)==null?void 0:i.source}}};var c,d,p;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    label: 'Gastos mes',
    value: '€234',
    color: '#10B981',
    icon: '💰'
  }
}`,...(p=(d=s.parameters)==null?void 0:d.docs)==null?void 0:p.source}}};var m,u,g;o.parameters={...o.parameters,docs:{...(m=o.parameters)==null?void 0:m.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12
  }}>
      <StatCard label="Tareas hoy" value="3" color="#4F46E5" />
      <StatCard label="Ideas activas" value="8" color="#F59E0B" />
      <StatCard label="Gastos mes" value="€234" color="#10B981" />
      <StatCard label="Miembros" value="5" color="var(--color-brand)" />
    </div>
}`,...(g=(u=o.parameters)==null?void 0:u.docs)==null?void 0:g.source}}};const C=["Default","WithIcon","Grid"];export{a as Default,o as Grid,s as WithIcon,C as __namedExportsOrder,S as default};
