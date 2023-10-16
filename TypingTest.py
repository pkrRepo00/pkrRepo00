import time

def typing_speed_test():
    # Define a longer typing test prompt.
    prompt = """
    This is a longer typing speed test prompt. It's designed to challenge your typing skills and measure your speed and accuracy.
    Feel free to take your time to read and understand this prompt before you start typing. Once you're ready, press Enter and begin the test.

    Typing is an essential skill for many professions, including programming, data entry, and content creation. Improving your typing speed and accuracy can make you more efficient in your work.

    Now, let's begin. Type this entire prompt as fast as you can, and we will measure your typing speed and accuracy. Ready? Press Enter to start.

    """

    # Display instructions to the user.
    print("Type the following prompt as fast as you can:")
    print(prompt)
    input("Press Enter when you're ready...")

    start_time = time.time()

    user_input = input("Start typing: ")

    end_time = time.time()
    total_time = end_time - start_time

    correct_characters = 0
    for i in range(min(len(prompt), len(user_input)):
        if prompt[i] == user_input[i]:
            correct_characters += 1

    words = len(prompt.split())

    # Calculate typing speed in WPM (Words Per Minute) and accuracy.
    typing_speed = (correct_characters / 5) / (total_time / 60)  # WPM
    accuracy = (correct_characters / len(prompt)) * 100  # Accuracy in percentage

    # Display the results to the user.
    print(f"\nYour typing speed: {typing_speed:.2f} WPM")
    print(f"Accuracy: {accuracy:.2f}%")

if __name__ == "__main__":
    typing_speed_test()
