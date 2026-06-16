import{j as t}from"./iframe-DCrcDkvy.js";import{D as y}from"./button-C7vNkC8I.js";import"./preload-helper-Dp1pzeXC.js";function p({icon:l="📭",title:m,description:r,action:u}){return t.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px 24px",textAlign:"center",fontFamily:"var(--font-body)"},children:[t.jsx("span",{style:{fontSize:48,marginBottom:16},children:l}),t.jsx("h3",{style:{fontSize:16,fontWeight:700,color:"var(--color-text)",margin:"0 0 6px"},children:m}),r&&t.jsx("p",{style:{fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.5,margin:"0 0 16px",maxWidth:300},children:r}),u]})}p.__docgenInfo={description:"",methods:[],displayName:"DsEmptyState",props:{icon:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:"'📭'",computed:!1}},title:{required:!0,tsType:{name:"string"},description:""},description:{required:!1,tsType:{name:"string"},description:""},action:{required:!1,tsType:{name:"ReactNode"},description:""}}};const h={title:"Design System/Empty State",component:p,tags:["autodocs"]},e={args:{title:"No tasks yet",description:"Create your first task to get started.",icon:"📋"}},s={args:{title:"No ideas yet",description:"Be the first to share an idea with your group.",icon:"💡",action:t.jsx(y,{size:"sm",children:"New Idea"})}};var o,i,a;e.parameters={...e.parameters,docs:{...(o=e.parameters)==null?void 0:o.docs,source:{originalSource:`{
  args: {
    title: 'No tasks yet',
    description: 'Create your first task to get started.',
    icon: '📋'
  }
}`,...(a=(i=e.parameters)==null?void 0:i.docs)==null?void 0:a.source}}};var n,c,d;s.parameters={...s.parameters,docs:{...(n=s.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    title: 'No ideas yet',
    description: 'Be the first to share an idea with your group.',
    icon: '💡',
    action: <DsButton size="sm">New Idea</DsButton>
  }
}`,...(d=(c=s.parameters)==null?void 0:c.docs)==null?void 0:d.source}}};const D=["Default","WithAction"];export{e as Default,s as WithAction,D as __namedExportsOrder,h as default};
