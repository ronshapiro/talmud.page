#!/usr/bin/env python3
"""
Fine-tunes Gemma 4 on the talmud.page RSI dataset using Unsloth (4-bit QLoRA).
Exports the merged model directly to GGUF format for Ollama serving.
"""

import argparse
import os
import sys

def parse_command_line_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fine-tune Gemma 4 on talmud.page RSI dataset using Unsloth."
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="google/gemma-4-e2b-it",
        help="Base model from Hugging Face (e.g. google/gemma-4-e2b-it or google/gemma-4-e4b-it).",
    )
    parser.add_argument(
        "--dataset-path",
        type=str,
        default="precomputed/rsi_state/sft_dataset.jsonl",
        help="Path to the training dataset JSONL file.",
    )
    parser.add_argument(
        "--output-model-name",
        type=str,
        default="gemma4-e2b-rsi-rashi-v1",
        help="Name for the exported GGUF file and Ollama model.",
    )
    parser.add_argument(
        "--maximum-sequence-length",
        type=int,
        default=2048,
        help="Maximum token sequence length.",
    )
    parser.add_argument(
        "--number-of-epochs",
        type=int,
        default=1,
        help="Number of training epochs.",
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=2e-4,
        help="Learning rate for AdamW.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=4,
        help="Per-device training batch size.",
    )
    parser.add_argument(
        "--gradient-accumulation-steps",
        type=int,
        default=4,
        help="Number of update steps to accumulate gradients.",
    )
    return parser.parse_args()

def main() -> None:
    arguments = parse_command_line_arguments()

    if not os.path.exists(arguments.dataset_path):
        print(f"Error: dataset file '{arguments.dataset_path}' not found.", file=sys.stderr)
        print("Please run `python3 rsi_orchestrator/create_sft_dataset.py` first.", file=sys.stderr)
        sys.exit(1)

    print("Importing Unsloth and PyTorch libraries...")
    from datasets import load_dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from unsloth import FastLanguageModel

    print(f"Loading base model: {arguments.model_name} in 4-bit...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=arguments.model_name,
        max_seq_length=arguments.maximum_sequence_length,
        load_in_4bit=True,
    )

    print("Configuring LoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0.0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    print(f"Loading dataset from: {arguments.dataset_path}...")
    dataset = load_dataset("json", data_files=arguments.dataset_path, split="train")

    def format_chat_messages(batch: dict) -> dict:
        formatted_texts = []
        for conversation in batch["messages"]:
            formatted_text = tokenizer.apply_chat_template(
                conversation,
                tokenize=False,
                add_generation_prompt=False,
            )
            formatted_texts.append(formatted_text)
        return {"text": formatted_texts}

    formatted_dataset = dataset.map(format_chat_messages, batched=True)

    training_arguments = TrainingArguments(
        output_dir=f"./results-{arguments.output_model_name}",
        per_device_train_batch_size=arguments.batch_size,
        gradient_accumulation_steps=arguments.gradient_accumulation_steps,
        warmup_steps=50,
        num_train_epochs=arguments.number_of_epochs,
        learning_rate=arguments.learning_rate,
        fp16=True,
        logging_steps=10,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=42,
    )

    print("Initializing SFTTrainer...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=formatted_dataset,
        dataset_text_field="text",
        max_seq_length=arguments.maximum_sequence_length,
        dataset_num_proc=2,
        args=training_arguments,
    )

    print("Starting fine-tuning...")
    trainer.train()

    output_gguf_directory = f"./exported_gguf/{arguments.output_model_name}"
    os.makedirs(output_gguf_directory, exist_ok=True)
    print(f"Exporting model to 4-bit GGUF in {output_gguf_directory}...")
    model.save_pretrained_gguf(
        output_gguf_directory,
        tokenizer,
        quantization_method="q4_k_m",
    )

    modelfile_path = os.path.join(output_gguf_directory, "Modelfile")
    gguf_filename = f"{arguments.output_model_name}-q4_k_m.gguf"
    with open(modelfile_path, "w", encoding="utf-8") as modelfile:
        modelfile.write(f"FROM ./{gguf_filename}\n")
        modelfile.write("PARAMETER temperature 0.2\n")

    print("\n" + "=" * 60)
    print("Fine-tuning and export complete!")
    print(f"GGUF and Modelfile written to: {output_gguf_directory}")
    print(f"To import into Ollama, run:")
    print(f"  cd {output_gguf_directory} && ollama create {arguments.output_model_name} -f Modelfile")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
