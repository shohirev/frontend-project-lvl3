import onChange from 'on-change';
import axios from 'axios';
import i18next from 'i18next';
import validate from './validator';
import render from './render';
import resources from './locales/index';
import proxify from './proxify';
import parseRSS from './RSSParser';
import update from './updateFeed';

export default () => {
  const i18nextInstance = i18next.createInstance();
  return i18nextInstance
    .init({
      lng: 'ru',
      resources,
    })
    .then((translate) => {
      const state = {
        process: 'initializing',
        feeds: [],
        posts: [],
        updateInterval: 5000,
        error: null,
        uiState: {
          modalWindowPostTitle: null,
        },
      };

      const pageElements = {
        mainTitle: document.querySelector('title'),
        addChannelsBtn: document.querySelector('.btn[name=add]'),
        inputField: document.getElementById('rss-input'),
        feedbackContainer: document.getElementById('feedback'),
        feedsListTitle: document.querySelector('div#feeds h2'),
        postsListTitle: document.querySelector('div#posts h2'),
        feedsList: document.getElementById('feeds-list'),
        postsList: document.getElementById('posts-list'),
        modalTitle: document.querySelector('.modal-title'),
        modalBody: document.querySelector('.modal-body'),
        modalFollowLinkBtn: document.getElementById('modalFollowLinkBtn'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
      };

      const watchedState = onChange(state, (changedStateSection, changedStateValue) => {
        const renderingProcesses = ['initializing', 'processingRequest', 'waiting'];

        if (changedStateSection === 'process' && renderingProcesses.includes(changedStateValue)) {
          render(watchedState, pageElements, translate);
        }
      });

      render(watchedState, pageElements, translate);

      const form = document.getElementById('rss-form');

      form.addEventListener('submit', (e) => {
        e.preventDefault();

        watchedState.process = 'processingRequest';

        const rssChannelUrl = document.getElementById('rss-input').value;

        try {
          const loadedUrls = watchedState.feeds.map((feed) => feed.url);
          validate(rssChannelUrl, loadedUrls);
        } catch (validationError) {
          const error = validationError.errors[0];
          watchedState.error = error;
          watchedState.process = 'waiting';
          return;
        }

        axios
          .get(proxify(rssChannelUrl))
          .then((response) => response.data.contents)
          .catch(() => {
            watchedState.error = 'networkError';
            watchedState.process = 'waiting';
          })
          .then((rssChannel) => {
            const parsedRssChannel = parseRSS(rssChannel);
            const { title, description, posts } = parsedRssChannel;
            const newFeed = { url: rssChannelUrl, title, description };

            watchedState.feeds.unshift(newFeed);
            watchedState.posts.unshift(...posts);

            watchedState.error = null;
            watchedState.process = 'waiting';

            setTimeout(() => {
              update(rssChannelUrl, watchedState);
            }, watchedState.updateInterval);
          })
          .catch((err) => {
            watchedState.error = err.message;
            watchedState.process = 'waiting';
          });
      });
    });
};
