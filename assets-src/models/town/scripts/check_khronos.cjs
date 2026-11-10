// Optional official Khronos glTF-Validator check. npm install gltf-validator first.
const fs=require('fs'),path=require('path');const validator=require('gltf-validator');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
(async()=>{let results=[];for(const name of fs.readdirSync(path.join(root,'models')).filter(n=>n.endsWith('.glb')).sort()){
 let data=fs.readFileSync(path.join(root,'models',name));let report=await validator.validateBytes(new Uint8Array(data),{uri:name,maxIssues:100});results.push({name,validatorVersion:validator.version(),...report});console.log(name,report.issues.numErrors+' errors',report.issues.numWarnings+' warnings');}
 fs.writeFileSync(path.join(root,'reports','khronos-validation.json'),JSON.stringify(results,null,2));if(results.some(r=>r.issues.numErrors))process.exitCode=1;
})();
