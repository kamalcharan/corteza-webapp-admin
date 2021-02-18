import Vue from 'vue'

import './config-check'
import './console-splash'

import './plugins'
import './mixins'
import './components'
import './filters'

import i18n from './i18n'
import store from './store'
import router from './router'

import { system } from '@cortezaproject/corteza-js'
import { mixins, corredor } from '@cortezaproject/corteza-vue'

const notProduction = (process.env.NODE_ENV !== 'production')

export default (options = {}) => {
  options = {
    el: '#app',
    name: 'admin',
    template: '<div v-if="loaded"><router-view/><vue-progress-bar /></div>',

    mixins: [
      mixins.corredor,
    ],

    data: () => ({ loaded: false }),
    mounted () {
      this.$Progress.finish()
    },
    async created () {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.getAll('code')[0]

      if (code) {
        await this.$auth.useCode(code)
          .then(() => {
            // In case the api client jwt hasn't been set yet
            this.$SystemAPI.setJWT(this.$auth.JWT)
            this.$ComposeAPI.setJWT(this.$auth.JWT)
            this.$FederationAPI.setJWT(this.$auth.JWT)
            this.$MessagingAPI.setJWT(this.$auth.JWT)
          })
          .catch(() => {
            this.$auth.open()
          })
      }

      await this.$auth.check()
        .then(() => {
          if (!code) {
            return this.$auth.refresh()
          }
        })
        .catch(() => {
          this.$auth.open()
        })

      // Setup the progress bar
      this.$Progress.start()
      this.$router.beforeEach((to, from, next) => {
        this.$Progress.start()
        next()
      })
      this.$router.afterEach((to, from) => {
        this.$Progress.finish()
      })

      // ref to vue is needed inside compose helper
      // load and register bundle and list of client/server scripts

      const bundleLoaderOpt = {
        // Name of the bundle to load
        bundle: 'admin',

        // Debug logging
        verbose: notProduction,

        // Context for exec function (client scripts only!)
        //
        // Extended with additional helpers
        ctx: new corredor.WebappCtx({
          $invoker: this.$auth.user,
          authToken: this.$auth.JWT,
        }),
      }

      this.loadBundle(bundleLoaderOpt)
        .then(() => this.$SystemAPI.automationList({ excludeInvalid: true }))
        .then(this.makeAutomationScriptsRegistrator(
          // compose specific handler that routes  onManual events for server-scripts
          // to the proper endpoint on the API
          system.TriggerSystemServerScriptOnManual(this.$SystemAPI),
        ))
        .then(() => {
          this.loaded = true
          console.log(code)
          if (code) {
            this.$router.push({ name: 'dashboard' })
          }
        })
    },
    router,
    store,
    i18n: i18n(),

    // Any additional options we want to merge
    ...options,
  }

  return new Vue(options)
}
