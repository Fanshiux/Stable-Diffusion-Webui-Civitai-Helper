# -*- coding: UTF-8 -*-
import hashlib
import io
import os
import requests
from modules import shared
from requests import RequestException
from requests.adapters import HTTPAdapter, Retry
from urllib import parse

def_headers = {
    'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
}
version = "1.8.2"


# print for debugging
def printD(msg, end=None):
    print(f"[Civitai Helper] {msg}", end=end)


def read_chunks(file, size=io.DEFAULT_BUFFER_SIZE):
    """Yield pieces of data from a file-like object until EOF."""
    while True:
        chunk = file.read(size)
        if not chunk:
            break
        yield chunk


# Now, hashing uses the same way as pip's source code.
def gen_file_sha256(filename):
    block_size = 1 << 20
    h = hashlib.sha256()
    length = 0
    with open(os.path.realpath(filename), 'rb') as f:
        for block in read_chunks(f, size=block_size):
            length += len(block)
            h.update(block)

    hash_value = h.hexdigest()
    # printD(f"sha256: {hash_value} [{hr_size(length)}]")
    return hash_value


# get a subfolder list
def get_subfolders(folder: str):
    if not folder:
        printD("folder can not be None")
        return

    if not os.path.isdir(folder):
        printD("path is not a folder")
        return

    prefix_len = len(folder)
    subfolders = []
    for root, dirs, files in os.walk(folder, followlinks=True):
        for dir in dirs:
            full_dir_path = os.path.join(root, dir)
            # get a subfolder path from it
            subfolder = full_dir_path[prefix_len:]
            subfolders.append(subfolder)

    return subfolders


# get a relative path
def get_relative_path(item_path: str, parent_path: str) -> str:
    # item path must start with parent_path
    if not item_path:
        return ""
    if not parent_path:
        return ""
    if not item_path.startswith(parent_path):
        return item_path

    relative = item_path[len(parent_path):]
    if relative[:1] == "/" or relative[:1] == "\\":
        relative = relative[1:]

    # printD("relative:"+relative)
    return relative


# get a relative path
def shorten_path(filepath: str) -> str:
    idx = filepath.find('embeddings' + os.sep)
    mi = filepath.find("models" + os.sep)
    if idx >= 0:
        return filepath[idx:]
    elif mi >= 0:
        return filepath[mi:]
    return filepath


# human readable size format
def hr_size(size, decimal_places=2):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB', 'PB']:
        if size < 1024.0 or unit == 'PiB':
            break
        size /= 1024.0
    return f"{size:.{decimal_places}f} {unit}"


# Get file_name from file_strs
def get_file_names_from_file_strs(file_strs: list) -> str:
    return ["_".join(file_str.split("_")[:-1]) for file_str in file_strs]


def get_url_from_base_url(url: str, token: bool = True, prefix: bool = False) -> str:
    base_url = shared.opts.data.get("ch_base_url")
    ch_civitai_api_key = shared.opts.data.get("ch_civitai_api_key")

    if base_url:
        if prefix:
            url = base_url if base_url[-1] == "/" else base_url + "/" + url
        else:
            url = parse.urljoin(base_url, parse.urlparse(url).path)

    if ch_civitai_api_key and token:
        url += "?token=" + ch_civitai_api_key

    return url


# Request method
def request(url: str, to_json: bool = False, download_tip: bool = False, prefix: bool = False, token: bool = True, **kwargs):
    retry = Retry(connect=5, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount('http://', adapter)
    session.mount('https://', adapter)

    url = get_url_from_base_url(url, token, prefix)
    if download_tip:
        printD("Start downloading: " + url)
    try:
        r = session.get(url, headers=def_headers, timeout=10, **kwargs)
        if not r.ok:
            if r.status_code == 404:
                printD("The request cannot be obtained")
            else:
                printD("Get error code: " + str(r.status_code))
                printD(r.text)
                return
            raise RequestException()
        if to_json:
            try:
                return r.json()
            except Exception as e:
                printD("Parse response json failed")
                printD(str(e))
                printD("response:")
                printD(r.text)
                raise RequestException()
        return r
    except RequestException as e:
        printD(f"{url}: " + e)
