// Install the actual locally bundled icons, not a mock or a remote provider.
import { addIcon } from '@iconify/vue';
import { init } from 'virtual:nuxt-ui-icons';
init(addIcon);
