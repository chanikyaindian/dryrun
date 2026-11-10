const listHelpers = `class Node:
    def __init__(self, val, next_node=None):
        self.val = val
        self.next = next_node

def make_list(values):
    head = None
    for value in reversed(values):
        head = Node(value, head)
    return head

def values_of(head):
    values = []
    while head is not None:
        values.append(head.val)
        head = head.next
    return values

`;

const treeHelpers = `class TreeNode:
    def __init__(self, val, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

`;

export const list = (code, variables, output) => ({ code: listHelpers + code, variables, output, nodeClass: 'Node' });
export const tree = (code, variables, output) => ({ code: treeHelpers + code, variables, output, nodeClass: 'TreeNode' });

export const interviewLessons51to75 = {
  'minimum-number-of-arrows-to-burst-balloons': {
    variables: ['balloons', 'start', 'end', 'arrow', 'count'],
    output: '2',
    code: `def min_arrows(balloons):
    balloons = sorted(balloons, key=lambda pair: pair[1])
    arrow, count = None, 0
    for start, end in balloons:
        if arrow is None or start > arrow:
            arrow = end
            count += 1  # Step: Place arrow | Shoot at this balloon's right endpoint to leave room for later overlaps.
        else:
            continue  # Step: Reuse arrow | The current shot also falls inside this balloon.
    return count

print(min_arrows([[1, 5], [2, 3], [3, 7], [8, 10]]))`,
  },
  'valid-parentheses': {
    variables: ['text', 'char', 'stack', 'opener'],
    output: 'True\nFalse',
    code: `def balanced(text):
    closing = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char not in closing:
            stack.append(char)  # Step: Push opener | Save this opening bracket until its matching closer appears.
        elif not stack:
            return False
        else:
            opener = stack.pop()  # Step: Pop opener | Compare the closer with the most recent unmatched opener.
            if opener != closing[char]:
                return False
    return not stack

print(balanced("([{}])"))
print(balanced("([)]"))`,
  },
  'simplify-path': {
    variables: ['path', 'part', 'stack'],
    output: '/docs/guide',
    code: `def simplify(path):
    stack = []
    for part in path.split("/"):
        if part == "" or part == ".":
            continue  # Step: Skip segment | Empty segments and a single dot leave the directory unchanged.
        if part == "..":
            if stack:
                stack.pop()  # Step: Go up | Remove the last directory. At the root there is nothing to remove.
        else:
            stack.append(part)  # Step: Enter directory | Add a regular directory name to the path.
    return "/" + "/".join(stack)

print(simplify("/docs//draft/.././guide/"))`,
  },
  'min-stack': {
    variables: ['values', 'minimums', 'value'],
    output: '1\n1\n3\n5',
    code: `class MinStack:
    def __init__(self):
        self.values = []
        self.minimums = []

    def push(self, value):
        self.values.append(value)
        minimums = self.minimums
        values = self.values
        current = min(value, minimums[-1]) if minimums else value
        minimums.append(current)  # Step: Save minimum | Store the minimum at the new stack depth.

    def pop(self):
        minimums = self.minimums
        values = self.values
        values.pop()
        minimums.pop()  # Step: Restore minimum | Pop the matching minimum so the previous depth is on top.

    def top(self):
        return self.values[-1]

    def get_min(self):
        return self.minimums[-1]

stack = MinStack()
stack.push(5)
stack.push(3)
stack.push(1)
stack.push(1)
print(stack.get_min())
stack.pop()
print(stack.get_min())
stack.pop()
print(stack.get_min())
stack.pop()
print(stack.top())`,
  },
  'evaluate-reverse-polish-notation': {
    variables: ['token', 'stack', 'left', 'right', 'value'],
    output: '6',
    code: `def evaluate(tokens):
    stack = []
    for token in tokens:
        if token not in ["+", "-", "*", "/"]:
            stack.append(int(token))  # Step: Push number | Keep the operand until an operator uses it.
            continue
        right = stack.pop()
        left = stack.pop()
        if token == "+":
            value = left + right
        elif token == "-":
            value = left - right
        elif token == "*":
            value = left * right
        else:
            quotient = abs(left) // abs(right)
            value = -quotient if (left < 0) != (right < 0) else quotient
        stack.append(value)  # Step: Apply operator | Put the result back on the stack. Division truncates toward zero.
    return stack[-1]

print(evaluate(["-7", "3", "/", "4", "+", "3", "*"]))`,
  },
  'basic-calculator': {
    variables: ['char', 'number', 'sign', 'total', 'stack'],
    output: '9',
    code: `def calculate(text):
    stack = []
    total, number, sign = 0, 0, 1
    for char in text:
        if char.isdigit():
            number = number * 10 + int(char)
        elif char == "+" or char == "-":
            total += sign * number  # Step: Commit operand | Add the completed number using the previous sign.
            number = 0
            sign = 1 if char == "+" else -1
        elif char == "(":
            stack.append([total, sign])  # Step: Enter group | Save the outer total and the sign in front of the parentheses.
            total, number, sign = 0, 0, 1
        elif char == ")":
            outer_total, outer_sign = stack.pop()
            total = outer_total + outer_sign * (total + sign * number)  # Step: Close group | Apply the saved sign to the group and add it to the outer total.
            number = 0
    return total + sign * number

print(calculate("12 - (5 - (2 + 1)) - 1"))`,
  },
  'linked-list-cycle': list(`def has_cycle(head):
    slow, fast = head, head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next  # Step: Advance pointers | Slow moves one hop and fast moves two.
        met = slow is fast  # Step: Check for meeting | If both pointers reach the same node, the list has a cycle.
        if met:
            return True
    return False

head = make_list([1, 2, 3, 4])
head.next.next.next.next = head.next
print(has_cycle(head))`, ['slow', 'fast', 'met'], 'True'),
  'add-two-numbers': list(`def add_lists(left, right):
    dummy = Node(0)
    tail, carry = dummy, 0
    while left is not None or right is not None or carry:
        total = carry
        if left is not None:
            total += left.val
            left = left.next
        if right is not None:
            total += right.val
            right = right.next
        carry, digit = divmod(total, 10)  # Step: Split sum | Write the ones digit and carry the tens into the next column.
        tail.next = Node(digit)  # Step: Append digit | Link the new digit to the end of the result.
        tail = tail.next
    return dummy.next

print(values_of(add_lists(make_list([9, 9]), make_list([6, 1]))))`, ['total', 'carry', 'digit', 'tail'], '[5, 1, 1]'),
  'merge-two-sorted-lists': list(`def merge_lists(left, right):
    dummy = Node(0)
    tail = dummy
    while left is not None and right is not None:
        if left.val <= right.val:
            tail.next = left  # Step: Link left node | The left head is the smallest remaining value.
            left = left.next
        else:
            tail.next = right  # Step: Link right node | The right head is smaller, so append it next.
            right = right.next
        tail = tail.next
    tail.next = left if left is not None else right  # Step: Attach remainder | The remaining list is already sorted.
    return dummy.next

print(values_of(merge_lists(make_list([1, 4, 7]), make_list([2, 3, 8]))))`, ['left', 'right', 'tail'], '[1, 2, 3, 4, 7, 8]'),
  'copy-list-with-random-pointer': list(`def copy_list(head):
    copies = {}
    node = head
    while node is not None:
        copies[node] = Node(node.val)  # Step: Copy node | Create one distinct copy for each original node.
        node = node.next
    node = head
    while node is not None:
        clone = copies[node]
        clone.next = copies.get(node.next)
        clone.random = copies.get(node.random)  # Step: Link to copies | Resolve both pointers in the clone map.
        node = node.next
    return copies.get(head)

head = make_list([7, 4, 9])
head.random = head.next.next
head.next.random = head
head.next.next.random = None
cloned = copy_list(head)
print(values_of(cloned))
print(cloned.random.val)
print(cloned is not head and cloned.random is not head.random)`, ['node', 'clone'], '[7, 4, 9]\n9\nTrue'),
  'reverse-linked-list-ii': list(`def reverse_between(head, left, right):
    dummy = Node(0, head)
    before = dummy
    for _ in range(left - 1):
        before = before.next
    tail = before.next
    for _ in range(right - left):
        move = tail.next
        tail.next = move.next  # Step: Detach node | Skip the node immediately after the fixed tail.
        move.next = before.next
        before.next = move  # Step: Insert at front | Put the detached node at the front of the reversed range.
    return dummy.next

print(values_of(reverse_between(make_list([1, 2, 3, 4, 5]), 2, 4)))`, ['left', 'right', 'before', 'tail', 'move'], '[1, 4, 3, 2, 5]'),
  'reverse-nodes-in-k-group': list(`def reverse_groups(head, k):
    dummy = Node(0, head)
    before = dummy
    while True:
        last = before
        for _ in range(k):
            last = last.next
            if last is None:
                return dummy.next
        after = last.next  # Step: Confirm full group | The next k nodes exist, so this group can be reversed.
        current, previous = before.next, after
        while current is not after:
            following = current.next
            current.next = previous  # Step: Reverse edge | Make this node point back toward the already reversed suffix.
            previous, current = current, following
        tail = before.next
        before.next = last  # Step: Connect group | Link the previous group to the new head of this group.
        before = tail

print(values_of(reverse_groups(make_list([1, 2, 3, 4, 5]), 2)))`, ['k', 'current', 'previous', 'last', 'after'], '[2, 1, 4, 3, 5]'),
  'remove-nth-node-from-end-of-list': list(`def remove_from_end(head, n):
    dummy = Node(0, head)
    slow, fast = dummy, dummy
    for _ in range(n):
        fast = fast.next  # Step: Open gap | Put n nodes between the slow and fast positions.
    while fast.next is not None:
        fast = fast.next
        slow = slow.next  # Step: Keep gap | Move together until fast reaches the tail.
    slow.next = slow.next.next  # Step: Skip target | Slow is directly before the node to remove.
    return dummy.next

print(values_of(remove_from_end(make_list([4, 6, 8, 10, 12]), 2)))`, ['n', 'slow', 'fast'], '[4, 6, 8, 12]'),
  'remove-duplicates-from-sorted-list-ii': list(`def unique_only(head):
    dummy = Node(0, head)
    before = dummy
    while before.next is not None:
        first = before.next
        after = first.next
        while after is not None and after.val == first.val:
            after = after.next  # Step: Scan duplicate run | Equal values are contiguous in the sorted list.
        if first.next is after:
            before = first  # Step: Keep singleton | This value appeared exactly once.
        else:
            before.next = after  # Step: Skip duplicate run | Link past every occurrence of the repeated value.
    return dummy.next

print(values_of(unique_only(make_list([1, 2, 2, 3, 4, 4, 5]))))`, ['before', 'first', 'after'], '[1, 3, 5]'),
  'rotate-list': list(`def rotate(head, k):
    if head is None:
        return head
    tail, length = head, 1
    while tail.next is not None:
        tail = tail.next
        length += 1
    shift = k % length  # Step: Reduce shift | A full turn returns every node to its original position.
    if shift == 0:
        return head
    new_tail = head
    for _ in range(length - shift - 1):
        new_tail = new_tail.next
    new_head = new_tail.next
    tail.next = head  # Step: Close cycle | Connect the old tail to the old head.
    new_tail.next = None  # Step: Cut cycle | End the list just before the new head.
    return new_head

print(values_of(rotate(make_list([1, 2, 3, 4, 5]), 7)))`, ['length', 'shift', 'head', 'tail', 'new_head', 'new_tail'], '[4, 5, 1, 2, 3]'),
  'partition-list': list(`def partition(head, pivot):
    smaller, larger = Node(0), Node(0)
    low, high = smaller, larger
    while head is not None:
        following = head.next
        head.next = None
        if head.val < pivot:
            low.next = head  # Step: Append to lower chain | Keep this smaller value in its original relative order.
            low = head
        else:
            high.next = head  # Step: Append to upper chain | Keep this value at or above the pivot in order.
            high = head
        head = following
    low.next = larger.next  # Step: Join chains | Place the upper chain after all smaller values.
    return smaller.next

print(values_of(partition(make_list([4, 1, 3, 2, 5, 2]), 3)))`, ['pivot', 'head', 'low', 'high'], '[1, 2, 2, 4, 3, 5]'),
  'lru-cache': {
    variables: ['key', 'value', 'evicted', 'entries'],
    nodeClass: 'Entry',
    output: '10\n-1\n10\n30',
    code: `class Entry:
    def __init__(self, key, val):
        self.key, self.val = key, val
        self.prev, self.next = None, None

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.entries = {}
        self.oldest, self.newest = Entry("oldest", 0), Entry("newest", 0)
        self.oldest.next = self.newest
        self.newest.prev = self.oldest

    def unlink(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def mark_recent(self, node):
        last = self.newest.prev
        node.prev, node.next = last, self.newest
        self.newest.prev = node
        last.next = node  # Step: Mark most recent | Move this entry just before the newest sentinel.

    def get(self, key):
        if key not in self.entries:
            return -1
        node = self.entries[key]
        self.unlink(node)
        self.mark_recent(node)
        return node.val

    def put(self, key, value):
        entries = self.entries
        if key in entries:
            node = entries[key]
            self.unlink(node)
            node.val = value
        else:
            node = Entry(key, value)
            entries[key] = node
        self.mark_recent(node)
        if len(entries) > self.capacity:
            evicted = self.oldest.next.key
            self.unlink(entries[evicted])
            entries.pop(evicted)  # Step: Evict oldest | Remove the least recently used entry from the list and index.

cache = LRUCache(2)
cache.put(1, 10)
cache.put(2, 20)
print(cache.get(1))
cache.put(3, 30)
print(cache.get(2))
print(cache.get(1))
print(cache.get(3))`,
  },
  'maximum-depth-of-binary-tree': tree(`def max_depth(node):
    if node is None:
        return 0
    left = max_depth(node.left)
    right = max_depth(node.right)
    depth = 1 + max(left, right)  # Step: Combine heights | Count this node and the deeper of its two subtrees.
    return depth

root = TreeNode(5, TreeNode(2), TreeNode(8, TreeNode(7)))
print(max_depth(root))`, ['node', 'left', 'right', 'depth'], '3'),
  'same-tree': tree(`def same_tree(first, second):
    if first is None or second is None:
        return first is second
    match = first.val == second.val  # Step: Compare nodes | Matching values are required before comparing the children.
    if not match:
        return False
    return same_tree(first.left, second.left) and same_tree(first.right, second.right)

first = TreeNode(5, TreeNode(2), TreeNode(8))
second = TreeNode(5, TreeNode(2), TreeNode(9))
print(same_tree(first, second))`, ['first', 'second', 'match'], 'False'),
  'invert-binary-tree': tree(`def invert(node):
    if node is None:
        return None
    node.left, node.right = node.right, node.left  # Step: Swap children | The left and right links exchange places at this node.
    invert(node.left)
    invert(node.right)
    return node

root = TreeNode(4, TreeNode(2, TreeNode(1), TreeNode(3)), TreeNode(7))
invert(root)
print([root.val, root.left.val, root.right.val, root.right.left.val, root.right.right.val])`, ['node'], '[4, 7, 2, 3, 1]'),
  'symmetric-tree': tree(`def mirror(left, right):
    if left is None or right is None:
        return left is right
    match = left.val == right.val  # Step: Compare mirrored nodes | Check the values before looking at opposite-side children.
    if not match:
        return False
    outer = mirror(left.left, right.right)  # Step: Compare outer branches | Pair the left tree's outer left with the right tree's outer right.
    return outer and mirror(left.right, right.left)

root = TreeNode(1, TreeNode(2, TreeNode(3)), TreeNode(2, None, TreeNode(3)))
print(mirror(root.left, root.right))`, ['left', 'right', 'match', 'outer'], 'True'),
  'construct-binary-tree-from-preorder-and-inorder-traversal': tree(`def build_tree(preorder, inorder):
    positions = {}
    for index in range(len(inorder)):
        positions[inorder[index]] = index
    cursor = 0

    def build(low, high):
        nonlocal cursor
        if low > high:
            return None
        value = preorder[cursor]
        cursor += 1
        pivot = positions[value]  # Step: Split inorder range | The next preorder value is the root. Inorder separates its left and right branches.
        node = TreeNode(value)
        node.left = build(low, pivot - 1)
        node.right = build(pivot + 1, high)  # Step: Attach subtrees | Preorder builds the left branch before the right.
        return node

    return build(0, len(inorder) - 1)

root = build_tree([5, 2, 1, 8, 7], [1, 2, 5, 7, 8])
print([root.val, root.left.val, root.right.val, root.left.left.val, root.right.left.val])`, ['preorder', 'inorder', 'cursor', 'low', 'high', 'pivot', 'node'], '[5, 2, 8, 1, 7]'),
  'construct-binary-tree-from-inorder-and-postorder-traversal': tree(`def build_tree(inorder, postorder):
    positions = {}
    for index in range(len(inorder)):
        positions[inorder[index]] = index
    cursor = len(postorder) - 1

    def build(low, high):
        nonlocal cursor
        if low > high:
            return None
        value = postorder[cursor]
        cursor -= 1
        pivot = positions[value]  # Step: Split inorder range | Reading postorder backward gives the root of this range first.
        node = TreeNode(value)
        node.right = build(pivot + 1, high)
        node.left = build(low, pivot - 1)  # Step: Attach subtrees | Reversed postorder visits the right branch before the left.
        return node

    return build(0, len(inorder) - 1)

root = build_tree([1, 2, 5, 7, 8], [1, 2, 7, 8, 5])
print([root.val, root.left.val, root.right.val, root.left.left.val, root.right.left.val])`, ['inorder', 'postorder', 'cursor', 'low', 'high', 'pivot', 'node'], '[5, 2, 8, 1, 7]'),
  'populating-next-right-pointers-in-each-node-ii': tree(`def connect(root):
    level = root
    while level is not None:
        dummy = TreeNode(0)
        dummy.next = None
        tail, node = dummy, level
        while node is not None:
            for child in [node.left, node.right]:
                if child is not None:
                    tail.next = child  # Step: Link across level | Append the child to the next level's chain, skipping missing children.
                    tail = child
            node = node.next
        level = dummy.next  # Step: Move down | Follow the next chain that was just built.
    return root

root = TreeNode(1, TreeNode(2, TreeNode(4)), TreeNode(3, None, TreeNode(7)))
root.next = None
root.left.next = None
root.right.next = None
root.left.left.next = None
root.right.right.next = None
connect(root)
print(root.left.next.val)
print(root.left.left.next.val)`, ['level', 'node', 'child', 'tail'], '3\n7'),
  'flatten-binary-tree-to-linked-list': tree(`def flatten(root):
    current = root
    while current is not None:
        if current.left is not None:
            tail = current.left
            while tail.right is not None:
                tail = tail.right
            tail.right = current.right  # Step: Save right subtree | Attach the right subtree after the left subtree's rightmost node.
            current.right = current.left
            current.left = None  # Step: Move left subtree | The former left branch now comes first on the right chain.
        current = current.right

root = TreeNode(1, TreeNode(2, TreeNode(3), TreeNode(4)), TreeNode(5, None, TreeNode(6)))
flatten(root)
chain = []
while root is not None:
    chain.append(root.val)
    root = root.right
print(chain)`, ['current', 'tail'], '[1, 2, 3, 4, 5, 6]'),
};
