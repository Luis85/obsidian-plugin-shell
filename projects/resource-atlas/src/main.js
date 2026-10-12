import './style.css';
import {createApp} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import ui from '@nuxt/ui/vue-plugin';
import App from './App.vue';
const app=createApp(App);
app.use(createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]}));
app.use(ui);
app.mount('#family-app');
