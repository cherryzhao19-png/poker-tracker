function validRecord(r) {
 if (!r || typeof r !== 'object') return false;
 if (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id)) return false;
 if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return false;
 const d=new Date(r.date+'T00:00:00Z');
 if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==r.date) return false;
 return typeof r.place==='string' && r.place.trim().length>0 && r.place.length<=80 && Number.isInteger(r.players) && r.players>=2 && r.players<=23 && Number.isSafeInteger(r.cents) && Math.abs(r.cents)<=99999999900;
}

const $=id=>document.getElementById(id);
let rows=[],editing=null,busy=false,loaded=false,pendingId=null;
const money=n=>(n<0?'-':n>0?'+':'')+'¥'+(Math.abs(n)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
function message(text){$('message').textContent=text}
function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);$('form').querySelectorAll('input').forEach(i=>i.disabled=value)}
async function refresh(){if(busy)return;lock(true);message('正在读取云端记录…');try{const data=await api();rows=data.records;loaded=true;$('account').textContent=data.email;render();message('已读取云端 · '+new Date().toLocaleTimeString())}catch(e){message('读取失败：'+e.message+'。可点击刷新重试。')}finally{lock(false)}}
async function commit(method,body){
 if(busy||!loaded){message('请先成功读取云端，再保存记录。');return false}
 lock(true);message('正在保存，请勿关闭页面…');try{const data=await api(method,body);rows=data.records;render();message('已保存到云端 · '+new Date().toLocaleTimeString());return true}catch(e){message('尚未确认保存：'+e.message+'。输入已保留；请先刷新核对云端结果，避免重复操作。');return false}finally{lock(false)}
}
function reset(){editing=null;pendingId=null;$('form').reset();$('date').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);$('formtitle').textContent='记下一场'}
function render(){
 const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date));const sum=rows.reduce((s,r)=>s+r.cents,0);
 $('total').textContent=loaded?money(sum):'—';$('count').textContent=loaded?rows.length:'—';$('rate').textContent=rows.length?Math.round(rows.filter(r=>r.cents>0).length/rows.length*100)+'%':'—';$('average').textContent=loaded?money(rows.length?Math.round(sum/rows.length):0):'—';
 let values=[0],v=0;sorted.forEach(r=>values.push(v+=r.cents));let lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||1;
 $('chart').innerHTML='<polyline fill="none" stroke="#d7b56c" stroke-width="2" points="'+values.map((n,i)=>(i/(values.length-1||1)*900)+','+(90-(n-lo)/range*80)).join(' ')+'"/>';
 const visible=sorted.filter(r=>!$('month').value||r.date.startsWith($('month').value));$('monthly').textContent=loaded?`当前范围 ${visible.length} 场 · 净输赢 ${money(visible.reduce((s,r)=>s+r.cents,0))}`:'等待云端读取';$('list').replaceChildren();
 if(loaded&&!visible.length)$('list').textContent='还没有记录。记下第一场，从这里开始。';
 visible.reverse().forEach(r=>{let el=document.createElement('div');el.className='record';let info=document.createElement('div'),title=document.createElement('b'),sub=document.createElement('small');title.textContent=r.place;sub.textContent=r.date+' · '+r.players+' 人局';info.append(title,sub);let side=document.createElement('div'),amt=document.createElement('div');amt.className='amount '+(r.cents<0?'loss':'profit');amt.textContent=money(r.cents);side.append(amt);
 for(const [name,fn] of [['编辑',()=>{if(busy)return;editing={...r};pendingId=null;for(let k of ['date','place','players'])$(k).value=r[k];$('amount').value=r.cents/100;$('formtitle').textContent='编辑记录';$('form').scrollIntoView({behavior:'smooth'})}],['删除',async()=>{if(!busy&&confirm('确定删除这场记录？建议先导出备份。')){if(await commit('DELETE',{id:r.id,revision:r.revision})){if(editing?.id===r.id)reset()}}}]]){let b=document.createElement('button');b.textContent=name;b.onclick=fn;side.append(b)}el.append(info,side);$('list').append(el)});
}
$('form').onsubmit=async e=>{e.preventDefault();if(busy)return;pendingId=pendingId||crypto.randomUUID();const r={id:editing?.id||pendingId,revision:editing?.revision,date:$('date').value,place:$('place').value.trim(),players:Number($('players').value),cents:Math.round(Number($('amount').value)*100)};if(await commit(editing?'PUT':'POST',r))reset()};
$('cancel').onclick=reset;$('month').onchange=render;$('all').onclick=()=>{$('month').value='';render()};$('refresh').onclick=refresh;
$('export').onclick=()=>{if(!loaded){message('请先读取云端记录再导出');return}const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:rows},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Poker-Tracker-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backup').textContent='已生成备份下载，请确认文件已保存到安全位置。'};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('文件过大，单次最多 1MB');const data=JSON.parse(await f.text());if(data.version!==1||!Array.isArray(data.records))throw Error('不支持此备份格式');if(data.records.length>1000||!data.records.every(validRecord))throw Error('备份内容无效，单次最多1000条');if(confirm('将 '+data.records.length+' 条记录导入当前账户？相同编号将跳过，不覆盖云端修改或恢复已删除记录。'))await commit('POST',{records:data.records})}catch(err){message('导入未完成：'+err.message)}finally{$('file').value=''}};
window.addEventListener('beforeunload',e=>{if(busy||$('place').value||$('amount').value){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',()=>message('网络已恢复，请刷新核对云端记录。'));
window.addEventListener('offline',()=>message('当前离线，无法保存到云端。请保留页面与输入，联网后重试。'));


let client=null,currentUser=null,authBusy=false;
function authMessage(text){$('auth-message').textContent=text}
function clearAccount(){rows=[];editing=null;pendingId=null;loaded=false;currentUser=null;reset();render();$('account').textContent='未登录';$('app-content').hidden=true;$('auth-box').hidden=false;$('logout').hidden=true;$('recovery-box').hidden=true;$('new-password').value=''}
function friendlyAuth(error){return ({'Invalid login credentials':'邮箱或密码不正确','Email not confirmed':'请先在邮箱中点击确认链接','User already registered':'此邮箱已注册，请直接登录','Failed to fetch':'无法连接服务，请检查网络'})[error.message]||error.message}
async function api(method='GET',body){
 if(!client||!currentUser)throw Error('请先登录');
 const accountId=currentUser.id;
 const request=method==='GET'?client.rpc('poker_tracker_snapshot'):client.rpc('poker_tracker_mutate',{p_method:method,p_body:body});
 const {data,error}=await request.abortSignal(AbortSignal.timeout(20000));if(error)throw Error(error.message);
 if(currentUser?.id!==accountId)throw Error('登录账户已变化，请刷新');
 return {...data,email:currentUser.email};
}
async function showAccount(user){
 if(currentUser?.id!==user.id){rows=[];loaded=false;reset();render()}
 currentUser=user;$('account').textContent=user.email;$('auth-box').hidden=true;$('app-content').hidden=false;$('logout').hidden=false;await refresh();
}
async function authAction(kind){
 if(!client||authBusy)return;authBusy=true;document.querySelectorAll('#auth-box button').forEach(b=>b.disabled=true);authMessage('正在处理…');
 try{
 const email=$('email').value.trim(),password=$('password').value;
 let result;
 if(kind==='reset'){
 if(!email)throw Error('请先填写邮箱');result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'});
 }else{
 if(!$('auth-form').reportValidity())return;
 result=kind==='signup'?await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'}}):await client.auth.signInWithPassword({email,password});
 }
 if(result.error)throw result.error;
 if(kind==='reset')authMessage('已提交重置申请。如果邮箱有效且允许发送，请查收邮件。');
 else if(result.data.session){$('password').value='';await showAccount(result.data.session.user)}
 else authMessage('注册申请已提交，请到邮箱确认，然后返回登录。若已注册，请直接登录或重置密码。');
 }catch(e){authMessage(friendlyAuth(e))}finally{authBusy=false;document.querySelectorAll('#auth-box button').forEach(b=>b.disabled=false)}
}
async function start(){
 reset();render();
 $('auth-form').onsubmit=e=>{e.preventDefault();authAction('login')};$('signup').onclick=()=>authAction('signup');$('forgot').onclick=()=>authAction('reset');
 $('logout').onclick=async()=>{if(busy)return;if(($('place').value||$('amount').value)&&!confirm('输入尚未保存，确定退出？'))return;const {error}=await client.auth.signOut();if(error){message('退出失败：'+error.message);return}clearAccount()};
 $('recovery-form').onsubmit=async e=>{e.preventDefault();const {error}=await client.auth.updateUser({password:$('new-password').value});if(error){$('recovery-message').textContent=friendlyAuth(error);return}$('new-password').value='';$('recovery-box').hidden=true;$('recovery-message').textContent='';if(currentUser)await showAccount(currentUser)};
 const config=window.POKER_CONFIG||{};
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl||'')||!config.supabasePublishableKey||config.supabasePublishableKey.startsWith('PASTE_')){authMessage('网站尚未配置云端。请按 README 填写 config.js 的 Project URL 和公开 publishable key。');return}
 if(!config.supabasePublishableKey.startsWith('sb_publishable_')){authMessage('请使用 sb_publishable_ 开头的公开密钥；禁止填入 secret 或 service_role 密钥。');return}
 try{
 const library=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
 client=library.createClient(config.supabaseUrl,config.supabasePublishableKey);
 client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{
 if(event==='SIGNED_OUT'){clearAccount();return}
 if(event==='PASSWORD_RECOVERY'){$('recovery-box').hidden=false;$('auth-box').hidden=true;$('app-content').hidden=true;currentUser=session?.user;return}
 if(event==='SIGNED_IN'&&session&&currentUser?.id!==session.user.id)showAccount(session.user);
 },0)});
 const {data,error}=await client.auth.getSession();if(error)throw error;
 if(data.session){await showAccount(data.session.user)}else authMessage('使用邮箱注册或登录，记录将保存在你的账户中。');
 }catch(e){authMessage('无法连接登录服务：'+friendlyAuth(e))}
}
start();
