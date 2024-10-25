/* eslint-disable  @typescript-eslint/no-empty-interface,@typescript-eslint/no-unused-vars */
import type {VNode} from 'vue';
import Vue from 'vue';
import type Moment from 'moment';

declare global {
  const moment: Moment;
  namespace JSX {
    interface Element extends VNode {}
    interface ElementClass extends Vue {}
    interface IntrinsicElements {
      [elem: string]: any;
    }
  }

  type JSObject = Record<string, any>;
  type Vue = Vue;
  const checkLoginPromise: Promise<string | null>;
  const loginChecker: any;
}
