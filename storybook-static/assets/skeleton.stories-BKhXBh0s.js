import{j as e}from"./iframe-DCrcDkvy.js";import"./preload-helper-Dp1pzeXC.js";function r({width:x="100%",height:o=16,circle:i=!1,count:n=1}){const y=Array.from({length:n});return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:8},children:[y.map((b,d)=>e.jsx("div",{style:{width:d===n-1&&n>1?"60%":x,height:o,borderRadius:i?"50%":"var(--radius-md)",background:"var(--color-muted)",animation:"ds-shimmer 1.5s infinite",...i?{width:o,aspectRatio:"1"}:{}}},d)),e.jsx("style",{children:`
        @keyframes ds-shimmer {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `})]})}r.__docgenInfo={description:"",methods:[],displayName:"DsSkeleton",props:{width:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:"'100%'",computed:!1}},height:{required:!1,tsType:{name:"number"},description:"",defaultValue:{value:"16",computed:!1}},circle:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},count:{required:!1,tsType:{name:"number"},description:"",defaultValue:{value:"1",computed:!1}}}};const S={title:"Design System/Skeleton",component:r,tags:["autodocs"]},s={args:{height:16,count:1}},a={render:()=>e.jsxs("div",{style:{background:"var(--color-surface)",borderRadius:"var(--radius-xl)",padding:20,border:"1px solid var(--color-border)",maxWidth:300},children:[e.jsx(r,{height:120,count:1}),e.jsx("div",{style:{height:12}}),e.jsx(r,{height:16,count:3})]})},t={render:()=>e.jsxs("div",{style:{display:"flex",gap:12,alignItems:"center"},children:[e.jsx(r,{height:40,circle:!0}),e.jsx("div",{style:{flex:1},children:e.jsx(r,{height:14,count:2})})]})};var l,c,u;s.parameters={...s.parameters,docs:{...(l=s.parameters)==null?void 0:l.docs,source:{originalSource:`{
  args: {
    height: 16,
    count: 1
  }
}`,...(u=(c=s.parameters)==null?void 0:c.docs)==null?void 0:u.source}}};var p,m,h;a.parameters={...a.parameters,docs:{...(p=a.parameters)==null?void 0:p.docs,source:{originalSource:`{
  render: () => <div style={{
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 20,
    border: '1px solid var(--color-border)',
    maxWidth: 300
  }}>
      <DsSkeleton height={120} count={1} />
      <div style={{
      height: 12
    }} />
      <DsSkeleton height={16} count={3} />
    </div>
}`,...(h=(m=a.parameters)==null?void 0:m.docs)==null?void 0:h.source}}};var g,f,v;t.parameters={...t.parameters,docs:{...(g=t.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: 12,
    alignItems: 'center'
  }}>
      <DsSkeleton height={40} circle />
      <div style={{
      flex: 1
    }}>
        <DsSkeleton height={14} count={2} />
      </div>
    </div>
}`,...(v=(f=t.parameters)==null?void 0:f.docs)==null?void 0:v.source}}};const D=["Default","CardLoading","AvatarLoading"];export{t as AvatarLoading,a as CardLoading,s as Default,D as __namedExportsOrder,S as default};
