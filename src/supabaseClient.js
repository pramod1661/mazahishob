const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (url && key) ? (() => {
  let accessToken = null;
  const authHeaders = () => ({
    apikey: key,
    Authorization: `Bearer ${accessToken || key}`,
    "Content-Type": "application/json"
  });
  const authBase = `${url}/auth/v1`;
  const restBase = `${url}/rest/v1`;

  return {
    setAccessToken(token){ accessToken = token || null; },
    auth: {
      async signUp({email,password,options}) {
        const r = await fetch(`${authBase}/signup`, { method:"POST", headers:authHeaders(), body:JSON.stringify({email,password,data:options?.data||{}}) });
        const d = await r.json();
        if(!r.ok) return {data:null,error:new Error(d.msg||d.error_description||d.message||"Signup failed")};
        if(d.access_token) accessToken = d.access_token;
        return {data:{user:d.user,session:d.access_token?{access_token:d.access_token}:null},error:null};
      },
      async signInWithPassword({email,password}) {
        const r = await fetch(`${authBase}/token?grant_type=password`, { method:"POST", headers:authHeaders(), body:JSON.stringify({email,password}) });
        const d = await r.json();
        if(!r.ok) return {data:null,error:new Error(d.error_description||d.msg||d.message||"Login failed")};
        accessToken = d.access_token || null;
        return {data:{user:d.user,session:d},error:null};
      },
      async signOut(){ accessToken = null; return {error:null}; }
    },
    from(table){
      return {
        select(columns){
          return {
            eq(field,value){
              return {
                async maybeSingle(){
                  const r=await fetch(`${restBase}/${table}?select=${encodeURIComponent(columns)}&${encodeURIComponent(field)}=eq.${encodeURIComponent(value)}`,{headers:authHeaders()});
                  const d=await r.json();
                  return {data:Array.isArray(d)?(d[0]||null):null,error:r.ok?null:new Error(d.message||"Query failed")};
                }
              };
            }
          };
        },
        async upsert(row,{onConflict}={}){
          const h={...authHeaders(),Prefer:"resolution=merge-duplicates,return=minimal"};
          const r=await fetch(`${restBase}/${table}?on_conflict=${encodeURIComponent(onConflict||"user_id")}`,{method:"POST",headers:h,body:JSON.stringify(row)});
          const d=await r.text();
          return {data:r.ok?null:d,error:r.ok?null:new Error(d||"Save failed")};
        }
      };
    }
  };
})() : null;
