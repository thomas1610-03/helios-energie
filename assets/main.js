/* Helios Energie — interactions du site (sans dépendance externe) */
(function () {
  'use strict';

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var mobileMenu = document.getElementById('menu-mobile');

  function closeMenu() {
    if (!toggle || !mobileMenu) return;
    toggle.setAttribute('aria-expanded', 'false');
    mobileMenu.hidden = true;
  }

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileMenu.hidden = open;
    });
    mobileMenu.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        toggle.focus();
      }
    });
  }

  /* ---------- Formulaire ---------- */
  var form = document.getElementById('callback-form');
  if (!form) return;

  // La validation est gérée en JavaScript ; sans JavaScript, la validation native du navigateur s'applique.
  form.noValidate = true;

  var submitBtn = document.getElementById('submit-btn');
  var submitLabel = submitBtn.querySelector('.btn-label');
  var summary = document.getElementById('error-summary');
  var summaryList = document.getElementById('error-summary-list');
  var alertBox = document.getElementById('form-alert');
  var success = document.getElementById('form-success');
  var prestationInputs = Array.prototype.slice.call(form.querySelectorAll('input[name="prestations"]'));
  var fsPrestations = document.getElementById('fs-prestations');
  var submitted = false;
  var sending = false;

  var CONTACT_EMAIL = 'helios-energie@monprojetchauffage.com';

  /* Zones climatiques par département (France métropolitaine).
     Information indicative transmise à l'équipe uniquement, jamais affichée comme critère d'éligibilité. */
  var ZONES = {
    H1: ['01','02','03','05','08','10','14','15','19','21','23','25','27','28','38','39','42','43','45','51','52','54','55','57','58','59','60','61','62','63','67','68','69','70','71','73','74','75','76','77','78','80','87','88','89','90','91','92','93','94','95'],
    H2: ['04','07','09','12','16','17','18','22','24','26','29','31','32','33','35','36','37','40','41','44','46','47','48','49','50','53','56','64','65','72','79','81','82','84','85','86'],
    H3: ['06','11','13','20','30','34','66','83']
  };

  function zoneFor(dept) {
    for (var z in ZONES) {
      if (ZONES[z].indexOf(dept) !== -1) return z;
    }
    return '';
  }

  function cleanPhone(value) {
    return value.replace(/[\s.\-()]/g, '');
  }

  function normalizePhone(value) {
    var v = cleanPhone(value);
    if (/^\+33[1-9]\d{8}$/.test(v)) v = '0' + v.slice(3);
    else if (/^0033[1-9]\d{8}$/.test(v)) v = '0' + v.slice(4);
    if (/^0[1-9]\d{8}$/.test(v)) return v.replace(/(\d{2})(?=\d)/g, '$1 ');
    return null;
  }

  /* Règles de validation : chaque règle renvoie un message d'erreur ou une chaîne vide */
  var rules = [
    {
      id: 'prestations',
      focus: function () { return prestationInputs[0]; },
      check: function () {
        return prestationInputs.some(function (i) { return i.checked; }) ? '' : 'Choisissez au moins une prestation.';
      }
    },
    {
      id: 'code_postal',
      check: function () {
        var v = form.code_postal.value.trim();
        if (!v) return 'Indiquez votre code postal.';
        if (!/^\d{5}$/.test(v)) return 'Le code postal doit comporter 5 chiffres (ex. : 69003).';
        var dept = parseInt(v.slice(0, 2), 10);
        if (dept < 1 || dept > 95) return 'Nous intervenons uniquement en France métropolitaine : vérifiez votre code postal.';
        return '';
      }
    },
    {
      id: 'nom',
      check: function () {
        var v = form.nom.value.trim();
        if (!v) return 'Indiquez votre nom.';
        if (v.length < 2) return 'Votre nom doit comporter au moins 2 caractères.';
        if (/\d/.test(v)) return 'Votre nom ne doit pas contenir de chiffres.';
        return '';
      }
    },
    {
      id: 'telephone',
      check: function () {
        var v = form.telephone.value.trim();
        if (!v) return 'Indiquez votre numéro de téléphone.';
        if (!normalizePhone(v)) return 'Ce numéro ne semble pas valide : indiquez un numéro français à 10 chiffres, par exemple 06 12 34 56 78.';
        return '';
      }
    },
    {
      id: 'email',
      check: function () {
        var v = form.email.value.trim();
        if (!v) return '';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Cette adresse e-mail ne semble pas valide (ex. : nom@exemple.fr).';
      }
    },
    {
      id: 'moment',
      focus: function () { return form.querySelector('input[name="moment_rappel"]'); },
      check: function () {
        return form.querySelector('input[name="moment_rappel"]:checked') ? '' : 'Choisissez un moment pour le rappel.';
      }
    },
    {
      id: 'consentement',
      check: function () {
        return form.consentement.checked ? '' : 'Cochez cette case pour que nous puissions vous recontacter.';
      }
    }
  ];

  function fieldFor(rule) {
    return rule.focus ? rule.focus() : document.getElementById(rule.id);
  }

  function setError(rule, message) {
    var errorEl = document.getElementById(rule.id + '-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }
    if (rule.id === 'prestations') {
      fsPrestations.classList.toggle('is-invalid', !!message);
      fsPrestations.setAttribute('aria-describedby', message ? 'prestations-hint prestations-error' : 'prestations-hint');
      return;
    }
    if (rule.id === 'moment') {
      var fs = document.getElementById('fs-moment');
      if (message) fs.setAttribute('aria-describedby', 'moment-error');
      else fs.removeAttribute('aria-describedby');
      return;
    }
    var input = document.getElementById(rule.id);
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function validateRule(rule) {
    var message = rule.check();
    setError(rule, message);
    return message;
  }

  function validateAll() {
    var errors = [];
    rules.forEach(function (rule) {
      var message = validateRule(rule);
      if (message) errors.push({ rule: rule, message: message });
    });
    return errors;
  }

  function showSummary(errors) {
    summaryList.innerHTML = '';
    if (!errors.length) {
      summary.hidden = true;
      return;
    }
    errors.forEach(function (err) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var target = fieldFor(err.rule);
      a.href = '#' + (target && target.id ? target.id : 'callback-form');
      a.textContent = err.message;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (target) {
          target.focus();
          target.scrollIntoView({ block: 'center' });
        }
      });
      li.appendChild(a);
      summaryList.appendChild(li);
    });
    summary.hidden = false;
  }

  // Les premières cases à cocher n'ont pas d'id : on leur en donne un pour les liens du récapitulatif d'erreurs
  prestationInputs.forEach(function (input) { if (!input.id) input.id = 'prestation-' + input.dataset.key; });
  var firstMoment = form.querySelector('input[name="moment_rappel"]');
  if (firstMoment && !firstMoment.id) firstMoment.id = 'moment-premier';

  // Validation à la sortie de chaque champ (après une première saisie), puis en direct après la 1re tentative d'envoi
  rules.forEach(function (rule) {
    var els = rule.id === 'prestations' ? prestationInputs
      : rule.id === 'moment' ? Array.prototype.slice.call(form.querySelectorAll('input[name="moment_rappel"]'))
      : [document.getElementById(rule.id)];
    els.forEach(function (el) {
      if (!el) return;
      el.addEventListener('blur', function () {
        if (submitted || (el.value && el.type !== 'checkbox' && el.type !== 'radio')) validateRule(rule);
      });
      el.addEventListener(el.type === 'checkbox' || el.type === 'radio' ? 'change' : 'input', function () {
        if (submitted) {
          validateRule(rule);
          showSummary(validateAllSilently());
        }
      });
    });
  });

  function validateAllSilently() {
    return rules.map(function (rule) { return { rule: rule, message: rule.check() }; })
      .filter(function (e) { return e.message; });
  }

  // Le code postal n'accepte que des chiffres
  form.code_postal.addEventListener('input', function () {
    var digits = this.value.replace(/\D/g, '').slice(0, 5);
    if (digits !== this.value) this.value = digits;
  });

  function setSending(state) {
    sending = state;
    submitBtn.disabled = state;
    form.setAttribute('aria-busy', String(state));
    if (state) {
      submitLabel.textContent = 'Envoi en cours…';
      if (!submitBtn.querySelector('.spinner')) {
        var s = document.createElement('span');
        s.className = 'spinner';
        s.setAttribute('aria-hidden', 'true');
        submitBtn.insertBefore(s, submitBtn.firstChild);
      }
    } else {
      submitLabel.textContent = 'Demander mon rappel';
      var sp = submitBtn.querySelector('.spinner');
      if (sp) sp.remove();
    }
  }

  function showAlert(message) {
    alertBox.textContent = '';
    alertBox.appendChild(document.createTextNode(message + ' '));
    var a = document.createElement('a');
    a.href = 'mailto:' + CONTACT_EMAIL;
    a.textContent = CONTACT_EMAIL;
    a.style.color = 'inherit';
    alertBox.appendChild(a);
    alertBox.appendChild(document.createTextNode('.'));
    alertBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    submitted = true;
    alertBox.hidden = true;

    var errors = validateAll();
    showSummary(errors);
    if (errors.length) {
      summary.focus();
      return;
    }

    var selected = prestationInputs.filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
    var cp = form.code_postal.value.trim();
    var dept = cp.slice(0, 2);
    var phone = normalizePhone(form.telephone.value);
    var moment = form.querySelector('input[name="moment_rappel"]:checked').value;

    var data = new FormData();
    data.append('prestations', selected.join(', '));
    data.append('code_postal', cp);
    data.append('departement', dept);
    data.append('zone_climatique_indicative', zoneFor(dept) || 'non déterminée');
    data.append('nom', form.nom.value.trim());
    data.append('telephone', phone);
    if (form.email.value.trim()) data.append('email', form.email.value.trim());
    data.append('moment_rappel', moment);
    data.append('consentement', form.consentement.value);
    data.append('_subject', 'Demande de rappel – ' + selected.join(', ') + ' – ' + cp);
    data.append('_gotcha', form._gotcha.value);

    setSending(true);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error('HTTP ' + response.status);
          err.body = body;
          throw err;
        });
      }
      // Envoi confirmé par le service de formulaire : on affiche la confirmation
      document.getElementById('recap-prestations').textContent = selected.join(', ');
      document.getElementById('recap-moment').textContent = moment;
      document.getElementById('recap-telephone').textContent = phone;
      form.hidden = true;
      success.hidden = false;
      var title = document.getElementById('success-title');
      title.focus();
      success.scrollIntoView({ block: 'center' });
    }).catch(function (err) {
      if (window.console && console.warn) console.warn('Envoi du formulaire impossible :', err && err.message);
      showAlert('Votre demande n’a pas pu être envoyée. Vérifiez votre connexion puis réessayez. Si le problème persiste, écrivez-nous à');
    }).then(function () {
      if (timer) clearTimeout(timer);
      setSending(false);
    });
  });

  /* ---------- Présélection d'une prestation depuis les boutons du site ---------- */
  function preselect(key) {
    var input = prestationInputs.filter(function (i) { return i.dataset.key === key; })[0];
    if (!input) return null;
    input.checked = true;
    if (submitted) validateRule(rules[0]);
    return input;
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-prestation]');
    if (!trigger) return;
    var input = preselect(trigger.getAttribute('data-prestation'));
    if (!input) return;
    if (!form.hidden) {
      e.preventDefault();
      if (history.replaceState) history.replaceState(null, '', '#demande');
      document.getElementById('demande').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      input.focus({ preventScroll: true });
    }
  });

  // Lien direct possible : ?prestation=pac (pac, combles, ssc, thermo, electrique)
  try {
    var param = new URLSearchParams(window.location.search).get('prestation');
    if (param) preselect(param);
  } catch (err) { /* navigateur ancien : rien à faire */ }

  /* ---------- Barre d'action mobile : masquée quand le formulaire est visible ---------- */
  var mobileCta = document.getElementById('mobile-cta');
  var demande = document.getElementById('demande');
  if (mobileCta && demande && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        mobileCta.classList.toggle('is-hidden', entry.isIntersecting);
      });
    }, { threshold: 0.05 });
    io.observe(demande);
  }
})();
