  // Research Assistant component begin

app.controller('prmResearchAssistantAfterController', ['$translate', function($translate) {
    var vm = this;
    
    vm.$onInit = function() {
        console.log('=== CUSTOM.JS: Controller initialized ===');
        
        function modifyText() {
            console.log('=== CUSTOM.JS: Starting text modification ===');
            
            var assistant = document.querySelector('cdi-research-assistant');
            console.log('=== CUSTOM.JS: Found research assistant:', !!assistant);
            
            if (!assistant) {
                console.log('=== CUSTOM.JS: Research assistant not found, trying again ===');
                setTimeout(modifyText, 1000);
                return;
            }

            var shadow = assistant.shadowRoot;
            console.log('=== CUSTOM.JS: Found shadow DOM:', !!shadow);
            
            if (!shadow) {
                console.log('=== CUSTOM.JS: Shadow DOM not found, trying again ===');
                setTimeout(modifyText, 1000);
                return;
            }

            var paragraph = shadow.querySelector('p.text-xl.mt-3');
            console.log('=== CUSTOM.JS: Found paragraph:', !!paragraph);
            
            if (paragraph) {
                console.log('=== CUSTOM.JS: Found matching paragraph, modifying ===');
                
                Promise.all([
                    $translate('nui.aria.primo_research_assistant.desc.first_line'),
                    $translate('nui.aria.primo_research_assistant.desc.second_line')
                ]).then(function(translations) {
                    var styleSheet = document.createElement('style');
                    styleSheet.textContent = `
                        .primo-ra-first-part {
                            display: block;
                            margin-bottom: 1rem;
                            font-weight: bold;
                        }
                        .primo-ra-second-part {
                            display: block;
                            color: #666666;
                        }
                    `;
                    shadow.appendChild(styleSheet);
                    
                    var wrapper = document.createElement('div');
                    var firstSpan = document.createElement('span');
                    var secondSpan = document.createElement('span');
                    firstSpan.className = 'primo-ra-first-part';
                    secondSpan.className = 'primo-ra-second-part';
                    firstSpan.textContent = translations[0] + ' ';
                    secondSpan.textContent = translations[1];
                    
                    wrapper.appendChild(firstSpan);
                    wrapper.appendChild(secondSpan);
                    paragraph.innerHTML = '';
                    paragraph.appendChild(wrapper);
                    console.log('=== CUSTOM.JS: Modification completed ===');
                });
            } else {
                console.log('=== CUSTOM.JS: Target paragraph not found or content mismatch, trying again ===');
                setTimeout(modifyText, 1000);
            }
        }
        
        setTimeout(modifyText, 500);
    };
}]);

app.component('prmResearchAssistantAfter', {
    bindings: {parentCtrl: '<'},
    controller: 'prmResearchAssistantAfterController'
});

// Research Assistant component end