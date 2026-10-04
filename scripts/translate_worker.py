import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
os.environ['ARGOS_PACKAGES_DIR'] = str(root / '.runtime' / 'argos' / 'packages')
os.environ['XDG_DATA_HOME'] = str(root / '.runtime' / 'argos' / 'data')
os.environ['XDG_CACHE_HOME'] = str(root / '.runtime' / 'argos' / 'cache')
os.environ['XDG_CONFIG_HOME'] = str(root / '.runtime' / 'argos' / 'config')
os.environ['ARGOS_DEVICE_TYPE'] = 'cpu'
os.environ['ARGOS_INTER_THREADS'] = '1'
os.environ['ARGOS_INTRA_THREADS'] = '4'
protocol = sys.stdout
sys.stdout = sys.stderr
import argostranslate.package
import argostranslate.translate
import spacy

if len(sys.argv) > 1 and sys.argv[1] == '--install':
    argostranslate.package.install_from_path(Path(sys.argv[2]))
    print('English -> Turkish model installed.', file=protocol)
    raise SystemExit(0)

checking = len(sys.argv) > 1 and sys.argv[1] == '--check'
if checking:
    import io
    import socket
    def no_network(*args, **kwargs):
        raise RuntimeError('Çevrimdışı çeviri kontrolünde ağ isteği engellendi.')
    socket.socket.connect = no_network
    sys.stdin = io.StringIO(json.dumps({'id': 0, 'texts': ['The room was quiet and warm.']}) + '\n')

class OfflineSentencizer:
    # English tokenizer rules and punctuation boundaries require no downloaded
    # statistical model. The old tokenizer bundled with en-tr 1.5 is incompatible
    # with modern Stanza; keep Argos's translation model and replace only SBD.
    def __init__(self):
        self.nlp = spacy.blank('en')
        self.nlp.add_pipe('sentencizer')

    def split_sentences(self, text):
        return [sentence.text for sentence in self.nlp(text).sents if sentence.text.strip()]

translator = None
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        if translator is None:
            installed = argostranslate.package.get_installed_packages()
            package = next((p for p in installed if p.from_code == 'en' and p.to_code == 'tr'), None)
            if package is None:
                raise RuntimeError('İngilizce-Türkçe modeli eksik. npm run setup:translation komutunu çalıştır.')
            translator = argostranslate.translate.PackageTranslation(None, None, package)
            translator.sentencizer = OfflineSentencizer()
        translated = [translator.translate(text) if text else '' for text in request['texts']]
        result = {'id': request['id'], 'translations': translated}
    except Exception as error:
        result = {'id': request.get('id'), 'error': str(error)}
    print(json.dumps(result, ensure_ascii=False), file=protocol, flush=True)
    if checking and 'error' in result:
        raise SystemExit(1)
