# -*- coding: UTF-8 -*-
# handle msg between js and python side
import json
import os
from modules import shared, paths_internal
from . import util

# this is the default root path
root_path = paths_internal.data_path

# if command line argument is used to change model folder,
# then model folder is in absolute path, not based on this root path anymore.
# so to make extension work with those absolute model folder paths, model folder also needs to be in absolute path
folders = {
    "ti": os.path.join(root_path, "embeddings"),
    "hyper": os.path.join(root_path, "models", "hypernetworks"),
    "ckp": os.path.join(root_path, "models", "Stable-diffusion"),
    "lora": os.path.join(root_path, "models", "Lora")
}

exts = (".bin", ".pt", ".safetensors", ".ckpt")
info_ext = ".info"
vae_suffix = ".vae"


# get a customer model path
def get_custom_model_folder():
    global folders

    if shared.cmd_opts.embeddings_dir and os.path.isdir(shared.cmd_opts.embeddings_dir):
        folders["ti"] = shared.cmd_opts.embeddings_dir

    if shared.cmd_opts.hypernetwork_dir and os.path.isdir(shared.cmd_opts.hypernetwork_dir):
        folders["hyper"] = shared.cmd_opts.hypernetwork_dir

    if shared.cmd_opts.ckpt_dir and os.path.isdir(shared.cmd_opts.ckpt_dir):
        folders["ckp"] = shared.cmd_opts.ckpt_dir

    if shared.cmd_opts.lora_dir and os.path.isdir(shared.cmd_opts.lora_dir):
        folders["lora"] = shared.cmd_opts.lora_dir


# write model info to file
def write_model_info(filepath, model_info):
    util.printD("Write model info: " + util.shorten_path(filepath))
    with open(os.path.realpath(filepath), 'w') as f:
        f.write(json.dumps(model_info, indent=4))


def load_model_info(path):
    # util.printD("Load model info from file: " + path)
    with open(os.path.realpath(path), 'r') as f:
        try:
            model_info = json.load(f)
        except Exception as e:
            util.printD("Selected file is not json: " + path)
            util.printD(e)
            return

    return model_info


# get model file names by model type
# parameter: model_type - string
# return: model name list
def get_model_names_by_type(model_type: str) -> list:
    model_folder = folders[model_type]

    # get information from filter
    # only get those model names don't have a civitai model info file
    model_names = []
    for root, dirs, files in os.walk(model_folder, followlinks=True):
        for filename in files:
            item = os.path.join(root, filename)
            # check extension
            base, ext = os.path.splitext(item)
            if ext in exts:
                # find a model
                model_names.append(filename)

    return model_names


# return two values: (model_root, model_path)
def get_model_path_by_type_and_name(model_type: str, model_name: str):
    if model_type not in folders.keys():
        util.printD("unknown model_type: " + model_type)
        return

    if not model_name:
        util.printD("model name can not be empty")
        return

    folder = folders[model_type]

    # model could be in subfolder, need to walk.
    for root, dirs, files in os.walk(folder, followlinks=True):
        for filename in files:
            if filename == model_name:
                # find model
                model_root = root
                model_path = os.path.join(root, filename)
                return model_root, model_path

    return


# Enter multiple file names and directories to determine if there are duplicate files
# return True if there are duplicate files
def check_duplicate_files(file_name: str, file_dir: str) -> bool:
    util.printD("Run check_duplicate_files")
    if not file_name:
        util.printD("file name can not be empty")
        return False

    if not file_dir:
        util.printD("file dir can not be empty")
        return False

    # check if file_name is in file_dir
    if file_name.lower() in [file_name.lower() for file_name in os.listdir(file_dir)]:
        util.printD("file_name is in file_dir")
        return True

    return False
