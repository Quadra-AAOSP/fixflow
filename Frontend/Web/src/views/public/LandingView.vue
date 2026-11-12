<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, ArrowUpRight, Check, MapPin, Wrench, ClipboardList, Menu } from '@lucide/vue';
import { useLocale } from '@/i18n';
import { useAuth } from '@/composables/useAuth';
import { accountHome } from '@/utils/navigation';
import SkipLink from '@/components/ui/SkipLink.vue';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { audiences, type Audience } from './landingContent';
import '@/styles/landing.css';
const props = defineProps<{ audience?: Audience }>();
const { t } = useLocale();
const { user } = useAuth();
const route = useRoute();
const signInTarget = computed(() => {
  const path = route.query.redirect;
  return typeof path === 'string' && path.startsWith('/') && !['/', '\\'].includes(path[1] ?? '') && ![...path].some(char => char.charCodeAt(0) < 32)
    ? { name: 'login', query: { redirect: path } } : { name: 'login' };
});
const content = computed(() => props.audience ? audiences[props.audience] : null);
const steps = computed(() => content.value?.steps ?? [
  ['Report it clearly', 'A location, a description, and helpful photos give every issue a useful starting point.'],
  ['Bring the right people together', 'Site teams review reports and coordinate the people who can help.'],
  ['Follow it through', 'Track progress, review completed work, and keep a shared record of the fix.'],
]);
</script>
<template>
  <div class="landing-page">
    <SkipLink />
    <header class="landing-header">
      <RouterLink to="/welcome" class="landing-brand" aria-label="FixFlow"><span class="landing-leaf"><i /><i /></span>FixFlow<span class="landing-brand-dot">.</span></RouterLink>
      <nav class="landing-desktop-nav" :aria-label="t('Explore FixFlow')"><RouterLink v-for="(item, key) in audiences" :key="key" :to="`/for/${key}`">{{ t(item.label) }}</RouterLink></nav>
      <div class="landing-header-actions"><LanguageSelector /><RouterLink v-if="user" class="action-link" :to="accountHome(user)">{{ t('Open workspace') }}<ArrowUpRight :size="16" /></RouterLink><RouterLink v-else class="landing-signin" :to="signInTarget">{{ t('Sign in') }}<ArrowUpRight :size="16" /></RouterLink></div>
      <details class="landing-mobile-nav"><summary><Menu :size="20" />{{ t('Explore FixFlow') }}</summary><nav :aria-label="t('Explore FixFlow')"><RouterLink v-for="(item, key) in audiences" :key="key" :to="`/for/${key}`" @click="($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t(item.label) }}</RouterLink></nav></details>
    </header>
    <main id="main-content" tabindex="-1">
      <p v-if="route.query.redirect" class="landing-access-note" role="status">{{ t('Sign in to continue to this page.') }} <RouterLink class="landing-how-link" :to="signInTarget">{{ t('Sign in') }}<ArrowRight :size="16" /></RouterLink></p>
      <section class="landing-hero">
        <div class="landing-hero-copy"><span class="landing-kicker"><i />{{ t(content?.eyebrow ?? 'Made for the places we share') }}</span>
          <h1>{{ t(content?.title ?? 'Little fixes. Better places.') }}</h1>
          <p>{{ t(content?.description ?? 'From the first report to the final fix, bring your community and maintenance team together. Make the spaces you share a little better, every day.') }}</p>
          <div class="action-row"><RouterLink class="landing-primary" :to="content?.to ?? '/register'">{{ t(content?.action ?? 'Get started') }}<ArrowRight :size="19" /></RouterLink><RouterLink v-if="content" class="action-link" to="/welcome">{{ t('Discover FixFlow') }}</RouterLink><a v-else class="landing-how-link" href="#how-it-works">{{ t('See how it works') }}<ArrowRight :size="17" /></a></div>
          <p class="landing-hero-note">{{ t('For schools, hostels, and hotels.') }}</p>
        </div>
        <div class="landing-scene" :aria-label="t('Illustration of a maintenance report moving from reported to resolved')" role="img">
          <span class="landing-scene-tag"><span />{{ t('A little care goes a long way') }}</span>
          <div class="landing-sample"><div class="landing-sample-top"><span class="landing-icon"><ClipboardList :size="24" /></span><span>{{ t('An everyday fix') }}<small>{{ t('Illustrative example') }}</small></span><span class="landing-sample-dots">•••</span></div><h2>{{ t('Let’s get that light working.') }}</h2><p><MapPin :size="15" />{{ t('Main building · Shared hallway') }}</p><div class="landing-sample-route"><span><Check :size="15" />{{ t('Reported') }}</span><i /><span><Wrench :size="15" />{{ t('In progress') }}</span></div><div class="landing-resolution"><span><Check :size="22" /></span><div><strong>{{ t('A brighter space.') }}</strong><p>{{ t('One small fix. A better day for everyone.') }}</p></div></div></div>
          <span class="landing-scene-footer">{{ t('Report it. Track it. Take care of it.') }}<span>✳</span></span>
        </div>
      </section>
      <div class="landing-principles"><span><Check :size="17" />{{ t('Clear locations') }}</span><span><Check :size="17" />{{ t('Shared progress') }}</span><span><Check :size="17" />{{ t('People working together') }}</span></div>
      <section v-if="!content" class="landing-section" aria-labelledby="audience-heading"><div class="landing-section-heading"><span class="landing-kicker">{{ t('One platform. A shared purpose.') }}</span><h2 id="audience-heading">{{ t('Find your place in the flow.') }}</h2><p>{{ t('Different roles, working towards the same better space.') }}</p></div><div class="landing-audiences"><RouterLink v-for="(item, key, index) in audiences" :key="key" :to="`/for/${key}`" class="landing-audience" :class="`landing-audience-${index}`"><span class="landing-icon"><component :is="item.icon" :size="25" /></span><h3>{{ t(item.label) }}</h3><p>{{ t(item.description) }}</p><span class="landing-card-link">{{ t('Explore your workspace') }}<ArrowRight :size="18" /></span></RouterLink></div></section>
      <section id="how-it-works" class="landing-section landing-process" aria-labelledby="process-heading"><div class="landing-section-heading"><span class="landing-kicker">{{ t('A clearer way forward') }}</span><h2 id="process-heading">{{ t(content ? 'Your next steps, made simple.' : 'From “something’s wrong” to sorted.') }}</h2></div><ol class="landing-steps"><li v-for="(step,index) in steps" :key="step[0]"><span class="landing-step-number">0{{ index + 1 }}</span><h3>{{ t(step[0]) }}</h3><p>{{ t(step[1]) }}</p></li></ol><p v-if="content" class="landing-access-note">{{ t(content.note) }}</p></section>
      <section v-if="!content" class="landing-section landing-faq" aria-labelledby="faq-heading"><div class="landing-section-heading"><span class="landing-kicker">{{ t('Good to know') }}</span><h2 id="faq-heading">{{ t('A few things before you begin.') }}</h2></div><div><details><summary>{{ t('How do I join my site?') }}</summary><p>{{ t('Create a reporter account using the site ID provided by your site administrator. If you do not have it, contact your administrator.') }}</p></details><details><summary>{{ t('Can I register as a site administrator?') }}</summary><p>{{ t('Site administration access is reviewed. Use Request a site to tell us about your organisation and proposed administrator.') }}</p><RouterLink class="landing-how-link" to="/request-site">{{ t('Request a site') }}<ArrowRight :size="16" /></RouterLink></details><details><summary>{{ t('Do technicians need to join a site first?') }}</summary><p>{{ t('No. Technician accounts start independently. A site contract is a separate agreement; eligibility for work depends on the applicable requirements.') }}</p></details></div></section>
      <section class="landing-cta"><div><span class="landing-kicker">{{ t('Small actions. Lasting care.') }}</span><h2>{{ t('Let’s keep good spaces good.') }}</h2><p>{{ t('Take the first step towards a better-maintained place.') }}</p></div><RouterLink class="landing-primary" :to="content?.to ?? '/register'">{{ t(content?.action ?? 'Get started') }}<ArrowRight :size="19" /></RouterLink></section>
    </main>
    <footer class="landing-footer"><RouterLink to="/welcome" class="landing-brand">FixFlow<span class="landing-brand-dot">.</span></RouterLink><span>{{ t('Made for the places we share.') }}</span><nav :aria-label="t('Useful links')"><RouterLink to="/access-policy">{{ t('Access requirements') }}</RouterLink><RouterLink to="/request-site">{{ t('Request a site') }}</RouterLink><RouterLink :to="signInTarget">{{ t('Sign in') }}</RouterLink></nav><small>© {{ new Date().getFullYear() }} FixFlow</small></footer>
  </div>
</template>
