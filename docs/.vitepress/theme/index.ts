import DefaultTheme from 'vitepress/theme';
import MermaidDiagram from './components/MermaidDiagram.vue';
import StrategyWizard from './components/StrategyWizard.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Target of the ```mermaid fence hook in config.mts.
    app.component('MermaidDiagram', MermaidDiagram);
    // Used by docs/strategy/index.md - the guided questionnaire that routes a
    // reader to one of the five blueprints.
    app.component('StrategyWizard', StrategyWizard);
  }
};
