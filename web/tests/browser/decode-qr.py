import sys
import cv2

image = cv2.imread(sys.argv[1])
if image is None:
    print("UNREADABLE")
    sys.exit(1)
text, _points, _ = cv2.QRCodeDetector().detectAndDecode(image)
print(text if text else "NONE")
