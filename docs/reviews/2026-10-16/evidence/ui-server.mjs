import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const server=await createServer({configFile:false,root:process.cwd(),plugins:[react(),tailwind()],server:{host:'127.0.0.1',port:5179,strictPort:true}});
await server.listen();console.log('REVIEW_UI_READY');
