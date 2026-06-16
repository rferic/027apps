import{r as T,j as s}from"./iframe-DCrcDkvy.js";import"./preload-helper-Dp1pzeXC.js";function d({checked:e,onChange:r,label:l,disabled:a}){const[j,w]=T.useState(!1),t=e!==void 0?e:j,C=()=>{if(a)return;const p=!t;e===void 0&&w(p),r==null||r(p)};return s.jsxs("button",{onClick:C,disabled:a,role:"switch","aria-checked":t,style:{display:"inline-flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:a?"not-allowed":"pointer",padding:0,fontFamily:"var(--font-body)",fontSize:"var(--font-size-sm)",color:"var(--color-text)",opacity:a?.5:1},children:[s.jsx("div",{style:{width:44,height:24,borderRadius:9999,background:t?"var(--color-brand)":"var(--color-border)",position:"relative",transition:"background var(--transition-fast)"},children:s.jsx("div",{style:{width:20,height:20,borderRadius:"50%",background:"white",position:"absolute",top:2,left:t?22:2,transition:"left var(--transition-fast)",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}})}),l&&s.jsx("span",{children:l})]})}d.__docgenInfo={description:"",methods:[],displayName:"DsToggle",props:{checked:{required:!1,tsType:{name:"boolean"},description:""},onChange:{required:!1,tsType:{name:"signature",type:"function",raw:"(checked: boolean) => void",signature:{arguments:[{type:{name:"boolean"},name:"checked"}],return:{name:"void"}}},description:""},label:{required:!1,tsType:{name:"string"},description:""},disabled:{required:!1,tsType:{name:"boolean"},description:""}}};const N={title:"Design System/Toggle",component:d,tags:["autodocs"]},o={args:{label:"Notifications"}},n={args:{label:"Dark mode",checked:!0}},c={args:{label:"Disabled",disabled:!0}},i={render:()=>{const[e,r]=T.useState(!1);return s.jsx(d,{label:`Toggle is ${e?"ON":"OFF"}`,checked:e,onChange:r})}};var u,g,m;o.parameters={...o.parameters,docs:{...(u=o.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    label: 'Notifications'
  }
}`,...(m=(g=o.parameters)==null?void 0:g.docs)==null?void 0:m.source}}};var b,h,f;n.parameters={...n.parameters,docs:{...(b=n.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    label: 'Dark mode',
    checked: true
  }
}`,...(f=(h=n.parameters)==null?void 0:h.docs)==null?void 0:f.source}}};var k,v,x;c.parameters={...c.parameters,docs:{...(k=c.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    label: 'Disabled',
    disabled: true
  }
}`,...(x=(v=c.parameters)==null?void 0:v.docs)==null?void 0:x.source}}};var y,D,S;i.parameters={...i.parameters,docs:{...(y=i.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => {
    const [checked, setChecked] = useState(false);
    return <DsToggle label={\`Toggle is \${checked ? 'ON' : 'OFF'}\`} checked={checked} onChange={setChecked} />;
  }
}`,...(S=(D=i.parameters)==null?void 0:D.docs)==null?void 0:S.source}}};const O=["Default","Checked","Disabled","Interactive"];export{n as Checked,o as Default,c as Disabled,i as Interactive,O as __namedExportsOrder,N as default};
