(function () {
    'use strict';

    // Store builds (Samsung/LG) preset lampa_settings.torrents_use = false and may
    // re-apply it after plugins load, so etor.js-style assignment is not enough.
    // This plugin pins the flags and restores the torrent UI directly.

    var TAG = 'ForceTorrents';
    var FLAGS = { torrents_use: true, demo: false, read_only: false };

    function pin(obj, key, value) {
        try {
            Object.defineProperty(obj, key, {
                get: function () { return value; },
                set: function () {},
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            try { obj[key] = value; } catch (e2) {}
            console.log(TAG, 'cannot pin', key, e.message);
        }
    }

    function pinAll() {
        if (!window.lampa_settings) window.lampa_settings = {};
        for (var key in FLAGS) pin(window.lampa_settings, key, FLAGS[key]);
        console.log(TAG, 'torrents_use =', window.lampa_settings.torrents_use);
    }

    // Settings main screen is built once at startup; if the flag was false then,
    // the Parser/TorrServer folders were removed from it. Put them back.
    function restoreSettingsFolders() {
        var main = Lampa.Settings.main && Lampa.Settings.main();
        if (!main) return;

        var comp = main.render();
        if (comp.find('[data-component="server"]').length) return;

        var folders = Lampa.Template.get('settings_main').find('[data-component="parser"], [data-component="server"]');
        var anchor = comp.find('[data-component="player"]');

        if (anchor.length) anchor.after(folders);
        else comp.find('.settings-folder').last().after(folders);

        main.update();
        console.log(TAG, 'settings folders restored');
    }

    function unhideCardButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') e.object.activity.render().find('.view--torrent').removeClass('hide');
        });
    }

    function start() {
        pinAll();
        restoreSettingsFolders();
        unhideCardButton();
    }

    pinAll();

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') start();
    });
})();
