angular.module('myApp.filters', [])
        .filter('timer', function() {
            return function(text) {
                if (typeof text != 'undefined') {
                    if (text.toFixed(2).toString().indexOf('-') >= 0) {
                        return '0:00';
                    } else {
                        return text.toFixed(2).toString().replace('.', ':').replace('-', '');
                    }
                }

            }
        }).filter('linebreak', function() {
            return function(text) {
                if (typeof text != 'undefined') {
                    return text.replace(/\n/g, '<br>');
                }

            }
        }).filter('to_trusted', ['$sce', function($sce) {
        return function(text) {
            if (typeof text != 'undefined') {
                return $sce.trustAsHtml(text);
            }
        };
}]);