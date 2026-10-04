import { defineStore } from 'pinia';
import { useItemsController } from '../composables/use-items-controller';

export const useItems = defineStore('items', useItemsController);
