import{r as i,j as e}from"./iframe-DCrcDkvy.js";import{D as a}from"./button-C7vNkC8I.js";import"./preload-helper-Dp1pzeXC.js";function l({open:o,onClose:t,title:n,children:u,maxWidth:m=480}){const s=i.useCallback(f=>{f.key==="Escape"&&t()},[t]);return i.useEffect(()=>(o&&document.addEventListener("keydown",s),()=>document.removeEventListener("keydown",s)),[o,s]),o?e.jsxs("div",{style:{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"},children:[e.jsx("div",{style:{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"},onClick:t}),e.jsxs("div",{role:"dialog","aria-modal":"true","aria-label":n,style:{position:"relative",background:"var(--color-surface)",borderRadius:"var(--radius-xl)",width:"90%",maxWidth:m,maxHeight:"90vh",overflow:"auto",padding:28,boxShadow:"0 16px 48px rgba(0,0,0,0.12)",fontFamily:"var(--font-body)"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20},children:[n&&e.jsx("h3",{style:{fontFamily:"var(--font-heading)",fontSize:18,fontWeight:700,color:"var(--color-text)",margin:0},children:n}),e.jsx("button",{onClick:t,"aria-label":"Close",style:{width:30,height:30,borderRadius:"var(--radius-md)",border:"none",background:"var(--color-muted)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--color-text-secondary)",fontSize:14,marginLeft:"auto"},children:"✕"})]}),u]})]}):null}l.__docgenInfo={description:"",methods:[],displayName:"DsModal",props:{open:{required:!0,tsType:{name:"boolean"},description:""},onClose:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""},title:{required:!1,tsType:{name:"string"},description:""},children:{required:!0,tsType:{name:"ReactNode"},description:""},maxWidth:{required:!1,tsType:{name:"number"},description:"",defaultValue:{value:"480",computed:!1}}}};const g={title:"Design System/Modal",component:l,tags:["autodocs"]},r={render:()=>{const[o,t]=i.useState(!1);return e.jsxs(e.Fragment,{children:[e.jsx(a,{onClick:()=>t(!0),children:"Open Modal"}),e.jsxs(l,{open:o,onClose:()=>t(!1),title:"Modal Title",children:[e.jsx("p",{style:{color:"var(--color-text-secondary)",lineHeight:1.6},children:"This is the modal content. Click the backdrop or press Escape to close."}),e.jsxs("div",{style:{marginTop:20,display:"flex",gap:8},children:[e.jsx(a,{onClick:()=>t(!1),children:"Confirm"}),e.jsx(a,{variant:"secondary",onClick:()=>t(!1),children:"Cancel"})]})]})]})}};var d,c,p;r.parameters={...r.parameters,docs:{...(d=r.parameters)==null?void 0:d.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = useState(false);
    return <>
        <DsButton onClick={() => setOpen(true)}>Open Modal</DsButton>
        <DsModal open={open} onClose={() => setOpen(false)} title="Modal Title">
          <p style={{
          color: 'var(--color-text-secondary)',
          lineHeight: 1.6
        }}>
            This is the modal content. Click the backdrop or press Escape to close.
          </p>
          <div style={{
          marginTop: 20,
          display: 'flex',
          gap: 8
        }}>
            <DsButton onClick={() => setOpen(false)}>Confirm</DsButton>
            <DsButton variant="secondary" onClick={() => setOpen(false)}>Cancel</DsButton>
          </div>
        </DsModal>
      </>;
  }
}`,...(p=(c=r.parameters)==null?void 0:c.docs)==null?void 0:p.source}}};const v=["Default"];export{r as Default,v as __namedExportsOrder,g as default};
