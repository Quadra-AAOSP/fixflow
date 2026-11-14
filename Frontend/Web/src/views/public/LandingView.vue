<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowRight, Check, Menu } from '@lucide/vue';
import { useLocale } from '@/i18n';
import { useAuth } from '@/composables/useAuth';
import { accountHome } from '@/utils/navigation';
import SkipLink from '@/components/ui/SkipLink.vue';
import { audiences, sharedSteps, type Audience } from './landingContent';
import '@/styles/landing.css';

const { t } = useLocale();
const { user } = useAuth();
const route = useRoute();
const audienceEntries = Object.entries(audiences) as [Audience, (typeof audiences)[Audience]][];

const signInTarget = computed(() => {
  const path = route.query.redirect;
  return typeof path === 'string' && path.startsWith('/') && !['/', '\\'].includes(path[1] ?? '') && ![...path].some(char => char.charCodeAt(0) < 32)
    ? { name: 'login', query: { redirect: path } } : { name: 'login' };
});

let revealObserver: IntersectionObserver | undefined;

function scrollToHash() {
  const id = route.hash.replace(/^#/, '');
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  await nextTick();
  scrollToHash();
  const nodes = document.querySelectorAll('.landing-reveal');
  if (typeof IntersectionObserver === 'undefined') {
    nodes.forEach(node => node.classList.add('is-visible'));
    return;
  }
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    }
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  nodes.forEach(node => revealObserver?.observe(node));
});

onBeforeUnmount(() => revealObserver?.disconnect());
watch(() => route.hash, async () => { await nextTick(); scrollToHash(); });
</script>

<template>
  <div class="landing-page">
    <SkipLink />
    <header class="landing-header">
      <RouterLink to="/welcome" class="landing-brand landing-brand-compact" aria-label="FixFlow">
        <span class="landing-leaf" aria-hidden="true"><i /><i /></span>FixFlow
      </RouterLink>
      <nav class="landing-desktop-nav" :aria-label="t('Explore FixFlow')">
        <a href="#roles">{{ t('Who it’s for') }}</a>
        <a href="#how-it-works">{{ t('How it works') }}</a>
        <a href="#faq">{{ t('FAQ') }}</a>
      </nav>
      <div class="landing-header-actions">
        <RouterLink v-if="user" class="landing-signin" :to="accountHome(user)">{{ t('Open workspace') }}</RouterLink>
        <RouterLink v-else class="landing-signin" :to="signInTarget">{{ t('Sign in') }}</RouterLink>
      </div>
      <details class="landing-mobile-nav">
        <summary><Menu :size="20" />{{ t('Explore FixFlow') }}</summary>
        <nav :aria-label="t('Explore FixFlow')">
          <a href="#roles" @click="($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t('Who it’s for') }}</a>
          <a href="#how-it-works" @click="($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t('How it works') }}</a>
          <a href="#faq" @click="($event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')">{{ t('FAQ') }}</a>
        </nav>
      </details>
    </header>

    <section class="landing-hero" aria-labelledby="landing-brand-title">
      <div class="landing-hero-media" aria-hidden="true">
        <img
          class="landing-hero-image"
          src="https://images.unsplash.com/photo-1583373834259-46cc92173cb7?auto=format&fit=crop&w=2000&q=85"
          alt=""
        />
        <div class="landing-hero-wash" />
      </div>
      <div class="landing-hero-copy">
        <p id="landing-brand-title" class="landing-hero-brand">FixFlow</p>
        <h1>{{ t('Little fixes. Better places.') }}</h1>
        <p class="landing-hero-lead">{{ t('Report issues, coordinate the right people, and follow every fix through — for schools, hostels, and hotels.') }}</p>
        <div class="landing-hero-actions">
          <a class="landing-primary" href="#roles">{{ t('Find your role') }}<ArrowRight :size="18" /></a>
          <RouterLink class="landing-secondary" :to="signInTarget">{{ t('Sign in') }}</RouterLink>
        </div>
      </div>
      <a class="landing-photo-credit" href="https://unsplash.com/photos/k4vFDPJoDZk" target="_blank" rel="noopener noreferrer">{{ t('Photo:') }} Camilo Botia / Unsplash</a>
    </section>

    <main id="main-content" tabindex="-1">
      <p v-if="route.query.redirect" class="landing-access-note" role="status">
        {{ t('Sign in to continue to this page.') }}
        <RouterLink class="landing-text-link" :to="signInTarget">{{ t('Sign in') }}<ArrowRight :size="16" /></RouterLink>
      </p>

      <section id="how-it-works" class="landing-section landing-reveal" aria-labelledby="process-heading">
        <div class="landing-section-heading">
          <h2 id="process-heading">{{ t('From something wrong to sorted.') }}</h2>
          <p>{{ t('One shared flow for the people who notice issues, the teams who coordinate them, and the technicians who fix them.') }}</p>
        </div>
        <ol class="landing-steps">
          <li v-for="(step, index) in sharedSteps" :key="step[0]">
            <span class="landing-step-number">0{{ index + 1 }}</span>
            <h3>{{ t(step[0]) }}</h3>
            <p>{{ t(step[1]) }}</p>
          </li>
        </ol>
      </section>

      <section id="roles" class="landing-section landing-roles landing-reveal" aria-labelledby="audience-heading">
        <div class="landing-section-heading">
          <h2 id="audience-heading">{{ t('Find your place in the flow.') }}</h2>
          <p>{{ t('Different roles, working towards the same better space.') }}</p>
        </div>

        <article
          v-for="([key, item], index) in audienceEntries"
          :id="key"
          :key="key"
          class="landing-role"
          :class="`landing-role-${index}`"
          :aria-labelledby="`${key}-heading`"
        >
          <div class="landing-role-intro">
            <span class="landing-role-icon" aria-hidden="true"><component :is="item.icon" :size="26" /></span>
            <p class="landing-role-eyebrow">{{ t(item.eyebrow) }}</p>
            <h3 :id="`${key}-heading`">{{ t(item.title) }}</h3>
            <p>{{ t(item.description) }}</p>
            <RouterLink class="landing-primary" :to="item.to">{{ t(item.action) }}<ArrowRight :size="18" /></RouterLink>
            <p class="landing-role-note">{{ t(item.note) }}</p>
          </div>
          <ol class="landing-role-steps">
            <li v-for="(step, stepIndex) in item.steps" :key="step[0]">
              <span>{{ String(stepIndex + 1).padStart(2, '0') }}</span>
              <div>
                <strong>{{ t(step[0]) }}</strong>
                <p>{{ t(step[1]) }}</p>
              </div>
            </li>
          </ol>
        </article>
      </section>

      <section id="faq" class="landing-section landing-faq landing-reveal" aria-labelledby="faq-heading">
        <div class="landing-section-heading">
          <h2 id="faq-heading">{{ t('A few things before you begin.') }}</h2>
        </div>
        <div class="landing-faq-list">
          <details>
            <summary>{{ t('How do I join my site?') }}</summary>
            <p>{{ t('Create a reporter account using the site ID provided by your site administrator. If you do not have it, contact your administrator.') }}</p>
          </details>
          <details>
            <summary>{{ t('Can I register as a site administrator?') }}</summary>
            <p>{{ t('Site administration access is reviewed. Use Request a site to tell us about your organisation and proposed administrator.') }}</p>
            <RouterLink class="landing-text-link" to="/request-site">{{ t('Request a site') }}<ArrowRight :size="16" /></RouterLink>
            <RouterLink class="landing-text-link" to="/site-application">{{ t('Track an application') }}<ArrowRight :size="16" /></RouterLink>
          </details>
          <details>
            <summary>{{ t('Do technicians need to join a site first?') }}</summary>
            <p>{{ t('No. Technician accounts start independently. A site contract is a separate agreement; eligibility for work depends on the applicable requirements.') }}</p>
          </details>
        </div>
      </section>

      <section class="landing-cta landing-reveal">
        <div>
          <h2>{{ t('Let’s keep good spaces good.') }}</h2>
          <p>{{ t('Take the first step towards a better-maintained place.') }}</p>
        </div>
        <div class="landing-hero-actions">
          <a class="landing-primary" href="#roles">{{ t('Find your role') }}<ArrowRight :size="18" /></a>
          <RouterLink class="landing-secondary landing-secondary-on-light" :to="signInTarget">{{ t('Sign in') }}</RouterLink>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <RouterLink to="/welcome" class="landing-brand landing-brand-compact" aria-label="FixFlow">
        <span class="landing-leaf" aria-hidden="true"><i /><i /></span>FixFlow
      </RouterLink>
      <span>{{ t('Made for the places we share.') }}</span>
      <nav :aria-label="t('Useful links')">
        <RouterLink to="/access-policy">{{ t('Access requirements') }}</RouterLink>
        <RouterLink to="/request-site">{{ t('Request a site') }}</RouterLink>
        <RouterLink to="/site-application">{{ t('Track an application') }}</RouterLink>
        <RouterLink :to="signInTarget">{{ t('Sign in') }}</RouterLink>
      </nav>
      <small>© {{ new Date().getFullYear() }} FixFlow</small>
    </footer>
  </div>
</template>
